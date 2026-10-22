import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCacheStore } from "./ai-cache";
import type { AiUsageStore } from "./ai-usage";
import type { SessionContext } from "./note-plan-schema";

const openAiMocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  imageGenerate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: openAiMocks.chatCreate } };
    images = { generate: openAiMocks.imageGenerate };
  },
}));

import { generateClientAvatar } from "./avatar-generation";
import {
  extractAssessmentFromPdfBuffer,
  extractAssessmentFromPdfText,
} from "./assessment-extract";
import { generateClinicalBodyOpenAI } from "./openai-notes";

function usageStore(
  rows: Array<{
    feature: string;
    userId: number | null;
    companyId: number | null;
    estimatedCostUsd: string;
  }> = [],
): AiUsageStore {
  return {
    listSince: vi.fn().mockResolvedValue(rows),
    insert: vi.fn().mockImplementation(async (record) => {
      rows.push({
        feature: record.feature,
        userId: record.userId,
        companyId: record.companyId,
        estimatedCostUsd: String(record.estimatedCostUsd),
      });
    }),
  };
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
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AI spend controls", () => {
  it("fails closed when a kill switch is missing and never calls the provider", async () => {
    vi.stubEnv("AVATAR_AI_ENABLED", "");
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
    await expect(
      generateClientAvatar(
        { firstName: "Avery" },
        { userId: 1, companyId: 1 },
        { usageStore: usageStore(rows) },
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(openAiMocks.imageGenerate).not.toHaveBeenCalled();
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
        choices: [{ message: { content: "{}" } }],
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
    expect(store.insert).toHaveBeenCalledTimes(2);
  });

  it("returns an assessment SHA-256 cache hit without parsing or calling OpenAI", async () => {
    const cacheStore: AiCacheStore = {
      get: vi.fn().mockResolvedValue({
        model: "older-model",
        expiresAt: null,
        response: {
          extracted: {},
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

  it("has no AI calls on client page load or client creation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../abanoteassistant/src/pages/new-client.tsx"),
      "utf8",
    );
    expect(source).not.toContain("void handleExtractFromPdf()");
    expect(source).not.toContain("generateAvatarMutation.mutate(newClientId");
    expect(source).toContain("onExtractFromPdf={handleExtractFromPdf}");
    expect(source).toContain("regenerateAvatarForCurrentClient");
  });

  it("keeps the staging smoke call explicitly gated and ledger-scoped", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../../scripts/note-eval/live-staging-smoke.ts"),
      "utf8",
    );
    expect(source).toContain('process.env.NOTE_SMOKE_STAGING !== "true"');
    expect(source).toContain("process.env.AI_ENABLED");
    expect(source).toContain("process.env.NOTE_AI_ENABLED");
    expect(source).toContain("userId: temporaryUserId!");
  });
});
