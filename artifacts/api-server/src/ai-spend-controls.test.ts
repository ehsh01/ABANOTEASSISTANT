import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCacheStore } from "./ai-cache";
import {
  enforceAiUsageLimits,
  reserveAiUsage,
  type AiUsageReservationInput,
  type AiUsageStore,
  type DailyUsageRow,
} from "./ai-usage";
import type { SessionContext } from "./note-plan-schema";

const openAiMocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  imageGenerate: vi.fn(),
  pdfParse: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: openAiMocks.chatCreate } };
    images = { generate: openAiMocks.imageGenerate };
  },
}));
vi.mock("pdf-parse", () => ({ default: openAiMocks.pdfParse }));

import { generateClientAvatar } from "./avatar-generation";
import {
  extractAssessmentFromPdfBuffer,
  extractAssessmentFromPdfText,
} from "./assessment-extract";
import { generateClinicalBodyOpenAI } from "./openai-notes";
import { isAiFeatureEnabled } from "./ai-config";
import { readCachedNoteGeneration } from "./note-ai-cache";

function usageStore(
  seed: Array<{
    feature: string;
    userId: number | null;
    companyId: number | null;
    estimatedCostUsd: string;
    operationId?: string;
    status?: string;
  }> = [],
): AiUsageStore {
  const rows: DailyUsageRow[] = seed.map((row, index) => ({
    ...row,
    id: index + 1,
    operationId: row.operationId ?? `seed-${index + 1}`,
    status: row.status ?? "completed",
  }));
  let nextId = rows.length + 1;
  let queue = Promise.resolve();
  const store: AiUsageStore = {
    reserve: vi.fn(async (input: AiUsageReservationInput) => {
      let unlock = () => {};
      const previous = queue;
      queue = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      await previous;
      try {
        enforceAiUsageLimits(rows, input);
        const row: DailyUsageRow = {
          id: nextId++,
          feature: input.feature,
          operationId: input.operationId,
          status: "reserved",
          userId: input.userId,
          companyId: input.companyId,
          estimatedCostUsd: String(input.reservedCostUsd),
        };
        rows.push(row);
        return {
          id: row.id,
          feature: input.feature,
          operationId: input.operationId,
          model: input.model,
        };
      } finally {
        unlock();
      }
    }),
    complete: vi.fn(async (reservation, usage) => {
      const row = rows.find((candidate) => candidate.id === reservation.id);
      if (!row) throw new Error("reservation not found");
      row.status = "completed";
      row.estimatedCostUsd = String(usage.estimatedCostUsd);
    }),
    fail: vi.fn(async (reservation) => {
      const row = rows.find((candidate) => candidate.id === reservation.id);
      if (!row) throw new Error("reservation not found");
      row.status = "failed";
      row.estimatedCostUsd = "0";
    }),
    release: vi.fn(async (reservation) => {
      const index = rows.findIndex((candidate) => candidate.id === reservation.id);
      if (index >= 0) rows.splice(index, 1);
    }),
  };
  return store;
}

function noteContext(): SessionContext {
  return {
    sessionHours: 1,
    sessionDate: "2026-10-22",
    therapySetting: "Home",
    clientAgeYears: 10,
    environmentalChanges: "",
    profileBehaviors: ["Task refusal"],
    profileBehaviorTargets: [
      { name: "Task refusal", topography: "pushed the worksheet away" },
    ],
    profileInterventions: ["Premack Principle"],
    reinforcementPreferences: ["tablet"],
    assessmentExcerpt: "Task refusal was defined as pushing work away.",
    assessmentReferenceFileName: "assessment.pdf",
    hourlyAssignments: [
      {
        segmentIndex: 0,
        programId: 1,
        programName: "Compliance Training",
        criterionPercentage: 20,
        activityHint: null,
        behaviorHint: "Task refusal",
      },
    ],
  };
}

function validNoteOutput(): string {
  return JSON.stringify({
    segments: [
      {
        segmentIndex: 0,
        behaviorLabel: "Task refusal",
        interventionLabels: ["Premack Principle"],
        paragraph:
          "At the dining table, the technician placed a worksheet in front of the client. Task refusal occurred when the client pushed the worksheet away. Premack Principle was used by presenting one short problem before tablet access. The client completed the problem and returned to the worksheet. Compliance Training was practiced with one-step directions, and 20% of trials met criterion.",
      },
    ],
  });
}

beforeEach(() => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("NOTE_AI_ENABLED", "true");
  vi.stubEnv("ASSESSMENT_AI_ENABLED", "true");
  vi.stubEnv("AVATAR_AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("AI_DAILY_BUDGET_USD", "10");
  openAiMocks.chatCreate.mockReset();
  openAiMocks.imageGenerate.mockReset();
  openAiMocks.pdfParse.mockReset();
  openAiMocks.pdfParse.mockResolvedValue({
    text: "Client information and behavior assessment text ".repeat(10),
    numpages: 2,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AI spend controls", () => {
  it("keeps every AI feature on when switches are unset", () => {
    delete process.env.AI_ENABLED;
    delete process.env.NOTE_AI_ENABLED;
    delete process.env.ASSESSMENT_AI_ENABLED;
    delete process.env.AVATAR_AI_ENABLED;

    expect(isAiFeatureEnabled("note")).toBe(true);
    expect(isAiFeatureEnabled("assessment")).toBe(true);
    expect(isAiFeatureEnabled("avatar")).toBe(true);
  });

  it.each(["false", " FALSE ", "0", " off ", "No"])(
    "disables only explicit false-like switch value %j",
    (disabled) => {
      vi.stubEnv("AI_ENABLED", disabled);
      expect(isAiFeatureEnabled("note")).toBe(false);
      vi.stubEnv("AI_ENABLED", "true");
      vi.stubEnv("AVATAR_AI_ENABLED", disabled);
      expect(isAiFeatureEnabled("avatar")).toBe(false);
    },
  );

  it.each(["", "enabled", "1", "yes"])(
    "keeps unrecognized or affirmative switch value %j on",
    (enabled) => {
      vi.stubEnv("AI_ENABLED", enabled);
      vi.stubEnv("NOTE_AI_ENABLED", enabled);
      expect(isAiFeatureEnabled("note")).toBe(true);
    },
  );

  it("blocks an explicit false switch without calling the provider", async () => {
    vi.stubEnv("AVATAR_AI_ENABLED", "false");
    await expect(
      generateClientAvatar(
        { firstName: "Avery" },
        { userId: 1, companyId: 1 },
        { usageStore: usageStore() },
      ),
    ).rejects.toThrow("AI is turned off.");
    expect(openAiMocks.imageGenerate).not.toHaveBeenCalled();
  });

  it("returns the cap error before an avatar provider call", async () => {
    const rows = Array.from({ length: 5 }, () => ({
      feature: "avatar",
      userId: 1,
      companyId: 1,
      estimatedCostUsd: "0.011",
    }));
    const store = usageStore(rows);
    await expect(
      generateClientAvatar(
        { firstName: "Avery" },
        { userId: 1, companyId: 1 },
        { usageStore: store },
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(openAiMocks.imageGenerate).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    expect(store.fail).not.toHaveBeenCalled();
    expect(store.release).not.toHaveBeenCalled();
  });

  it("counts usage after a provider call fails", async () => {
    const store = usageStore();
    openAiMocks.imageGenerate.mockRejectedValueOnce(
      new Error("provider disconnected after request"),
    );

    await expect(
      generateClientAvatar(
        { firstName: "Avery" },
        { userId: 1, companyId: 1 },
        { usageStore: store },
      ),
    ).rejects.toThrow("provider disconnected");

    expect(openAiMocks.imageGenerate).toHaveBeenCalledTimes(1);
    expect(store.fail).toHaveBeenCalledTimes(1);
    expect(store.complete).not.toHaveBeenCalled();
  });

  it("does not hide a successful avatar when ledger finalization fails", async () => {
    const store = usageStore();
    store.complete = vi.fn().mockRejectedValue(new Error("ledger unavailable"));
    openAiMocks.imageGenerate.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("png").toString("base64") }],
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await generateClientAvatar(
      { firstName: "Avery" },
      { userId: 1, companyId: 1 },
      { usageStore: store },
    );

    expect(result.png.toString()).toBe("png");
    expect(store.complete).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "[ai-usage] failed to finalize billed usage",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("prevents one user from exhausting the shared daily budget", async () => {
    const store = usageStore([
      {
        feature: "note",
        userId: 1,
        companyId: 1,
        estimatedCostUsd: "2.000000",
      },
    ]);

    await expect(
      reserveAiUsage(
        {
          feature: "note",
          operationId: "user-1-note",
          model: "gpt-4.1-mini",
          userId: 1,
          companyId: 1,
          reservedCostUsd: 0.01,
        },
        store,
      ),
    ).rejects.toThrow("Your daily AI budget has been reached");
    await expect(
      reserveAiUsage(
        {
          feature: "note",
          operationId: "user-2-note",
          model: "gpt-4.1-mini",
          userId: 2,
          companyId: 1,
          reservedCostUsd: 0.01,
        },
        store,
      ),
    ).resolves.toMatchObject({ operationId: "user-2-note" });
  });

  it("enforces global and per-company daily caps", async () => {
    const globalStore = usageStore([
      {
        feature: "note",
        userId: 9,
        companyId: 9,
        estimatedCostUsd: "9.900000",
      },
    ]);
    await expect(
      reserveAiUsage(
        {
          feature: "note",
          operationId: "global-block",
          model: "gpt-4.1-mini",
          userId: 2,
          companyId: 2,
          reservedCostUsd: 0.2,
        },
        globalStore,
      ),
    ).rejects.toThrow("daily AI budget");

    vi.stubEnv("NOTE_AI_DAILY_LIMIT_PER_COMPANY", "2");
    const companyStore = usageStore([
      {
        feature: "note",
        operationId: "company-note-1",
        userId: 1,
        companyId: 1,
        estimatedCostUsd: "0.01",
      },
      {
        feature: "note",
        operationId: "company-note-2",
        userId: 2,
        companyId: 1,
        estimatedCostUsd: "0.01",
      },
    ]);
    await expect(
      reserveAiUsage(
        {
          feature: "note",
          operationId: "company-note-3",
          model: "gpt-4.1-mini",
          userId: 3,
          companyId: 1,
          reservedCostUsd: 0.01,
        },
        companyStore,
      ),
    ).rejects.toThrow("company daily note AI limit");
  });

  it("counts note operations rather than repair calls", async () => {
    vi.stubEnv("NOTE_AI_DAILY_LIMIT_PER_USER", "1");
    const store = usageStore([
      {
        feature: "note",
        operationId: "same-note",
        userId: 1,
        companyId: 1,
        estimatedCostUsd: "0.01",
      },
      {
        feature: "note",
        operationId: "same-note",
        userId: 1,
        companyId: 1,
        estimatedCostUsd: "0.01",
      },
    ]);

    await expect(
      reserveAiUsage(
        {
          feature: "note",
          operationId: "same-note",
          model: "gpt-4.1-mini",
          userId: 1,
          companyId: 1,
          reservedCostUsd: 0.01,
        },
        store,
      ),
    ).resolves.toMatchObject({ operationId: "same-note" });
    await expect(
      reserveAiUsage(
        {
          feature: "note",
          operationId: "different-note",
          model: "gpt-4.1-mini",
          userId: 1,
          companyId: 1,
          reservedCostUsd: 0.01,
        },
        store,
      ),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("serializes concurrent reservations so the global budget cannot overshoot", async () => {
    vi.stubEnv("AI_DAILY_BUDGET_USD", "0.5");
    vi.stubEnv("AI_DAILY_BUDGET_USD_PER_USER", "0.25");
    const store = usageStore();
    const reservations = await Promise.allSettled(
      [1, 2, 3].map((userId) =>
        reserveAiUsage(
          {
            feature: "note",
            operationId: `concurrent-${userId}`,
            model: "gpt-4.1-mini",
            userId,
            companyId: userId,
            reservedCostUsd: 0.2,
          },
          store,
        ),
      ),
    );

    expect(
      reservations.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(2);
    expect(
      reservations.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("sets max_completion_tokens on note and assessment calls", async () => {
    vi.stubEnv("NOTE_AI_MAX_COMPLETION_TOKENS", "2345");
    vi.stubEnv("ASSESSMENT_AI_MAX_COMPLETION_TOKENS", "1234");
    openAiMocks.chatCreate
      .mockResolvedValueOnce({
        id: "note-1",
        model: "gpt-4.1-mini",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
        choices: [{ message: { content: validNoteOutput() } }],
      })
      .mockResolvedValueOnce({
        id: "assessment-1",
        model: "gpt-4.1-mini",
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                maladaptiveBehaviors: ["Task refusal"],
              }),
            },
          },
        ],
      });
    const store = usageStore();

    await generateClinicalBodyOpenAI(noteContext(), {
      usageIdentity: { userId: 1, companyId: 1 },
      usageStore: store,
    });
    await extractAssessmentFromPdfText(
      "Client information and behavior assessment text ".repeat(10),
      2,
      {
        usageIdentity: { userId: 1, companyId: 1 },
        usageStore: store,
      },
    );

    expect(openAiMocks.chatCreate.mock.calls[0]?.[0]).toMatchObject({
      max_completion_tokens: 2345,
    });
    expect(openAiMocks.chatCreate.mock.calls[1]?.[0]).toMatchObject({
      max_completion_tokens: 1234,
    });
    expect(store.complete).toHaveBeenCalledTimes(2);
  });

  it("rejects a truncated note completion after recording billed usage", async () => {
    const store = usageStore();
    openAiMocks.chatCreate.mockResolvedValueOnce({
      id: "note-truncated",
      model: "gpt-4.1-mini",
      usage: { prompt_tokens: 21, completion_tokens: 13, total_tokens: 34 },
      choices: [
        {
          finish_reason: "length",
          message: { content: validNoteOutput() },
        },
      ],
    });

    await expect(
      generateClinicalBodyOpenAI(noteContext(), {
        usageIdentity: { userId: 1, companyId: 1 },
        usageStore: store,
      }),
    ).rejects.toThrow(/truncated/i);
    expect(store.complete).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ promptTokens: 21, completionTokens: 13 }),
    );
  });

  it("returns an assessment SHA-256 cache hit without parsing or calling OpenAI", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    vi.stubEnv("OPENAI_API_KEY", "");
    const cacheStore: AiCacheStore = {
      get: vi.fn().mockResolvedValue({
        model: "older-model",
        expiresAt: null,
        response: {
          extracted: { maladaptiveBehaviors: ["Cached behavior"] },
          warnings: [],
          pdfPageCount: 4,
          pdfCharCount: 123,
        },
      }),
      put: vi.fn(),
    };

    const result = await extractAssessmentFromPdfBuffer(
      Buffer.from("same-pdf"),
      {
        usageIdentity: { userId: 1, companyId: 1 },
        cacheStore,
        usageStore: usageStore(),
      },
    );

    expect(result.pdfPageCount).toBe(4);
    expect(cacheStore.get).toHaveBeenCalledWith(
      "assessment",
      1,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(openAiMocks.chatCreate).not.toHaveBeenCalled();
    expect(cacheStore.put).not.toHaveBeenCalled();
  });

  it("serves a note cache hit without provider configuration and bypasses it for regenerate", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    vi.stubEnv("OPENAI_API_KEY", "");
    const cacheStore: AiCacheStore = {
      get: vi.fn().mockResolvedValue({
        model: "gpt-4.1-mini",
        expiresAt: null,
        response: {
          body: "Cached clinical body.",
          notePlan: JSON.parse(validNoteOutput()),
          modelUsed: "gpt-4.1-mini",
        },
      }),
      put: vi.fn(),
    };

    await expect(
      readCachedNoteGeneration({
        forceRegenerate: false,
        companyId: 1,
        cacheKey: "cached-note",
        model: "gpt-4.1-mini",
        store: cacheStore,
      }),
    ).resolves.toMatchObject({ body: "Cached clinical body." });
    expect(cacheStore.get).toHaveBeenCalledTimes(1);

    vi.mocked(cacheStore.get).mockClear();
    await expect(
      readCachedNoteGeneration({
        forceRegenerate: true,
        companyId: 1,
        cacheKey: "cached-note",
        model: "gpt-4.1-mini",
        store: cacheStore,
      }),
    ).resolves.toBeNull();
    expect(cacheStore.get).not.toHaveBeenCalled();
  });

  it("force re-extract bypasses an assessment cache hit", async () => {
    const cacheStore: AiCacheStore = {
      get: vi.fn().mockResolvedValue({
        model: "gpt-4.1-mini",
        expiresAt: null,
        response: {
          extracted: { maladaptiveBehaviors: ["Old behavior"] },
          warnings: [],
          pdfPageCount: 1,
          pdfCharCount: 10,
        },
      }),
      put: vi.fn(),
    };
    openAiMocks.chatCreate.mockResolvedValueOnce({
      id: "assessment-forced",
      model: "gpt-4.1-mini",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              maladaptiveBehaviors: ["Fresh behavior"],
            }),
          },
        },
      ],
    });

    const result = await extractAssessmentFromPdfBuffer(Buffer.from("force-pdf"), {
      usageIdentity: { userId: 1, companyId: 1 },
      cacheStore,
      usageStore: usageStore(),
      force: true,
    });

    expect(result.extracted.maladaptiveBehaviors).toEqual(["Fresh behavior"]);
    expect(cacheStore.get).not.toHaveBeenCalled();
    expect(openAiMocks.chatCreate).toHaveBeenCalledTimes(1);
    expect(cacheStore.put).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "truncated",
      finishReason: "length",
      content: "{}",
      error: /truncated/i,
    },
    {
      label: "empty",
      finishReason: "stop",
      content: "",
      error: /empty model response/i,
    },
    {
      label: "empty-object",
      finishReason: "stop",
      content: "{}",
      error: /returned no behaviors/i,
    },
  ])(
    "does not cache a $label billed assessment completion",
    async ({ finishReason, content, error }) => {
      const cacheStore: AiCacheStore = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
      };
      const store = usageStore();
      openAiMocks.chatCreate.mockResolvedValueOnce({
        id: "assessment-incomplete",
        model: "gpt-4.1-mini",
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
        choices: [
          {
            finish_reason: finishReason,
            message: { content },
          },
        ],
      });

      await expect(
        extractAssessmentFromPdfBuffer(Buffer.from(`pdf-${finishReason}-${content}`), {
          usageIdentity: { userId: 1, companyId: 1 },
          cacheStore,
          usageStore: store,
        }),
      ).rejects.toThrow(error);

      expect(cacheStore.put).not.toHaveBeenCalled();
      expect(store.complete).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ promptTokens: 11, completionTokens: 7 }),
      );
    },
  );

  it("has no AI calls on client page load or client creation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../abanoteassistant/src/pages/new-client.tsx"),
      "utf8",
    );
    expect(source).not.toContain("void handleExtractFromPdf()");
    expect(source).not.toContain("generateAvatarMutation.mutate(newClientId");
    expect(source).toContain("onExtractFromPdf={handleExtractFromPdf}");
    expect(source).toContain("regenerateAvatarForCurrentClient");
    const clientDetail = readFileSync(
      resolve(process.cwd(), "../abanoteassistant/src/pages/client-detail.tsx"),
      "utf8",
    );
    expect(clientDetail).toContain('"Generate avatar"');
    expect(clientDetail).toContain('"Regenerate avatar"');
    const uploadRoute = readFileSync(
      resolve(process.cwd(), "src/routes/client-assessment-document.ts"),
      "utf8",
    );
    expect(uploadRoute).not.toContain("extractAssessmentFromPdfText");
  });

  it("wires visible force-regeneration and force-re-extraction triggers", () => {
    const resultPage = readFileSync(
      resolve(process.cwd(), "../abanoteassistant/src/pages/result.tsx"),
      "utf8",
    );
    expect(resultPage).toContain("forceRegenerate: true");
    const noteService = readFileSync(
      resolve(process.cwd(), "src/notes-service.ts"),
      "utf8",
    );
    expect(noteService).toContain("body.forceRegenerate");
    expect(noteService.indexOf("await readCachedNoteGeneration")).toBeLessThan(
      noteService.indexOf('assertAiProviderConfigured("note")'),
    );

    const newClient = readFileSync(
      resolve(process.cwd(), "../abanoteassistant/src/pages/new-client.tsx"),
      "utf8",
    );
    expect(newClient).toContain("Re-extract fields from this PDF");
    expect(newClient).toContain("force: Boolean(extractSuccess)");
  });

  it("keeps the staging smoke call explicitly gated and ledger-scoped", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../../scripts/note-eval/live-staging-smoke.ts"),
      "utf8",
    );
    expect(source).toContain('process.env.NOTE_SMOKE_STAGING !== "true"');
    expect(source).toContain('assertAiFeatureEnabled("note")');
    expect(source).toContain("userId: temporaryUserId!");
  });
});
