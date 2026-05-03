import { Router, type IRouter, type Response } from "express";
import { and, eq, inArray, ne } from "drizzle-orm";
import {
  ListClientsResponse,
  GetClientParams,
  GetClientResponse,
  CreateClientBody,
  UpdateClientParams,
  UpdateClientBody,
  ListClientProgramsParams,
  ListClientProgramsResponse,
  ListClientBehaviorProgramApprovalsParams,
  ListClientBehaviorProgramApprovalsResponse,
  ListClientReplacementProgramsParams,
  ListClientReplacementProgramsResponse,
  PutClientBehaviorApprovedProgramsParams,
  PutClientBehaviorApprovedProgramsBody,
  PutClientBehaviorApprovedProgramsResponse,
  UpdateClientProgramParams,
  UpdateClientProgramBody,
  UpdateClientProgramResponse,
  DeleteClientProgramParams,
  DeleteClientProgramResponse,
  CreateClientClinicalRecommendationParams,
  CreateClientClinicalRecommendationBody,
  CreateClientClinicalRecommendationResponse,
  DeleteClientParams,
  DeleteClientResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  clientsTable,
  programsTable,
  clientProgramsTable,
  clientBehaviorProgramApprovalsTable,
  type ClientProfileRow,
} from "@workspace/db/schema";
import { clientRowToApiData } from "../client-profile-api";
import { expandMaladaptiveTargetsFromProfile, mergeMaladaptiveProfileFields } from "../client-profile-maladaptive";
import {
  getAssessmentStructuredFromProfile,
  parseAssessmentStructured,
  validateAssessmentStructured,
} from "../assessment-structured";
import { computeClinicalRecommendation } from "../recommendation-engine";
import { z } from "zod";

const router: IRouter = Router();

type AssessmentStatus = "uploaded" | "processing" | "ready" | "missing";

/**
 * Wizard and note generation use `client_programs` + `programs` rows.
 * Replacement program names live on `client.profile.replacementPrograms` from the intake form;
 * ensure each name has a matching program row (per company) and is linked to the client.
 *
 * Also **removes** `client_programs` links when a program name is no longer on the profile, so
 * note creation and GET /programs cannot show stale programs after the profile is edited.
 */
function replacementProgramNamesFromProfile(profile: unknown): string[] {
  if (profile === null || profile === undefined || typeof profile !== "object") {
    return [];
  }
  const raw = (profile as { replacementPrograms?: unknown }).replacementPrograms;
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .map((n) => String(n).trim())
          .filter((n) => n.length > 0),
      ),
    ];
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function normalizeProgramApiType(type: string | null | undefined): "primary" | "supplemental" {
  return type === "supplemental" ? "supplemental" : "primary";
}

function programRowToApiData(p: {
  id: number;
  companyId: number;
  name: string;
  type: string | null;
  description: string | null;
}) {
  return {
    id: p.id,
    companyId: p.companyId,
    name: p.name,
    type: normalizeProgramApiType(p.type),
    description: p.description ?? undefined,
  };
}

function removeProgramNameFromProfile(profile: ClientProfileRow, programName: string): ClientProfileRow {
  return {
    ...profile,
    replacementPrograms: profile.replacementPrograms.filter((n) => n !== programName),
  };
}

function renameProgramNameInProfile(
  profile: ClientProfileRow,
  from: string,
  to: string,
): ClientProfileRow {
  if (from === to) return profile;
  return {
    ...profile,
    replacementPrograms: profile.replacementPrograms.map((n) => (n === from ? to : n)),
  };
}

async function syncReplacementProgramsFromProfile(
  clientId: number,
  companyId: number,
  profile: unknown,
): Promise<void> {
  const names = replacementProgramNamesFromProfile(profile);
  const nameSet = new Set(names);

  const existingLinks = await db
    .select({
      linkId: clientProgramsTable.id,
      programName: programsTable.name,
    })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(
      and(eq(clientProgramsTable.clientId, clientId), eq(programsTable.companyId, companyId)),
    );

  for (const row of existingLinks) {
    if (!nameSet.has(row.programName.trim())) {
      await db.delete(clientProgramsTable).where(eq(clientProgramsTable.id, row.linkId));
    }
  }

  if (names.length === 0) {
    return;
  }

  for (const name of names) {
    const [existingProg] = await db
      .select()
      .from(programsTable)
      .where(and(eq(programsTable.companyId, companyId), eq(programsTable.name, name)))
      .limit(1);

    let programId: number;
    if (existingProg) {
      programId = existingProg.id;
    } else {
      const [inserted] = await db
        .insert(programsTable)
        .values({
          companyId,
          name,
          type: "primary",
          description: null,
        })
        .returning();
      if (!inserted) continue;
      programId = inserted.id;
    }

    const [existingLink] = await db
      .select()
      .from(clientProgramsTable)
      .where(
        and(
          eq(clientProgramsTable.clientId, clientId),
          eq(clientProgramsTable.programId, programId),
        ),
      )
      .limit(1);

    if (!existingLink) {
      await db.insert(clientProgramsTable).values({ clientId, programId });
    }
  }
}

async function selectLinkedProgramsForClient(
  clientId: number,
  companyId: number,
): Promise<
  Array<{
    id: number;
    companyId: number;
    name: string;
    type: string;
    description: string | null;
  }>
> {
  return db
    .select({
      id: programsTable.id,
      companyId: programsTable.companyId,
      name: programsTable.name,
      type: programsTable.type,
      description: programsTable.description,
    })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(
      and(
        eq(clientProgramsTable.clientId, clientId),
        eq(programsTable.companyId, companyId),
      ),
    );
}

/** Walk `Error.cause` — Drizzle wraps node-postgres so `code` / relation text are often on the inner error only. */
function walkErrorCauseChain(err: unknown): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur !== null && cur !== undefined) {
    if (typeof cur === "object") {
      if (seen.has(cur)) break;
      seen.add(cur);
    }
    out.push(cur);
    const next =
      cur instanceof Error && cur.cause !== undefined && cur.cause !== null ? cur.cause : undefined;
    cur = next;
  }
  return out;
}

function isMissingBehaviorApprovalsTable(err: unknown): boolean {
  for (const e of walkErrorCauseChain(err)) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "42P01" && /client_behavior_program_approvals/i.test(msg)) return true;
    if (/does not exist/i.test(msg) && /client_behavior_program_approvals/i.test(msg)) return true;
  }
  return false;
}

/** Prefer the innermost Postgres-style error message for API `messages` and logs. */
function extractDeepestDriverMessage(err: unknown): string {
  let best = err instanceof Error ? err.message : String(err);
  for (const e of walkErrorCauseChain(err)) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    if (code.length === 5 && /^[0-9A-Z]+$/.test(code) && e instanceof Error && e.message.trim()) {
      best = e.message;
    }
  }
  return best;
}

/** Remove approvals when the behavior or program link no longer exists on the client. */
async function pruneClientBehaviorProgramApprovals(
  clientId: number,
  profile: ClientProfileRow,
): Promise<void> {
  try {
    const allowedBehaviors = new Set(
      expandMaladaptiveTargetsFromProfile(profile).map((t) => t.name),
    );
    const linkRows = await db
      .select({ programId: clientProgramsTable.programId })
      .from(clientProgramsTable)
      .where(eq(clientProgramsTable.clientId, clientId));
    const allowedProgramIds = new Set(linkRows.map((r) => r.programId));

    const existing = await db
      .select({
        id: clientBehaviorProgramApprovalsTable.id,
        behaviorLabel: clientBehaviorProgramApprovalsTable.behaviorLabel,
        programId: clientBehaviorProgramApprovalsTable.programId,
      })
      .from(clientBehaviorProgramApprovalsTable)
      .where(eq(clientBehaviorProgramApprovalsTable.clientId, clientId));

    const staleIds = existing
      .filter(
        (r) =>
          !allowedBehaviors.has(r.behaviorLabel) || !allowedProgramIds.has(r.programId),
      )
      .map((r) => r.id);
    if (staleIds.length === 0) return;
    await db
      .delete(clientBehaviorProgramApprovalsTable)
      .where(inArray(clientBehaviorProgramApprovalsTable.id, staleIds));
  } catch (err) {
    if (isMissingBehaviorApprovalsTable(err)) {
      console.warn("[pruneClientBehaviorProgramApprovals] table missing; skip until migration");
      return;
    }
    throw err;
  }
}

/** Postgres `undefined_table` or driver message when `drizzle-kit push` was not run. */
function sendBehaviorApprovalsDbError(res: Response, err: unknown, context: string): void {
  const detail = extractDeepestDriverMessage(err);
  const missingTable = isMissingBehaviorApprovalsTable(err);
  console.error(`[${context}]`, err);
  if (missingTable) {
    res.status(503).json({
      success: false,
      error:
        "The behavior–program approvals table is missing in this database. From repo root (with artifacts/api-server/.env for this DB): pnpm --filter @workspace/db run ensure:behavior-approvals-table",
      messages: [],
    });
    return;
  }
  res.status(500).json({
    success: false,
    error: "Database error while processing behavior program approvals.",
    messages: [detail.length > 400 ? `${detail.slice(0, 400)}…` : detail],
  });
}

function resolveCanonicalBehaviorLabel(rawPath: string, profile: ClientProfileRow): string | null {
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    decoded = rawPath;
  }
  const t = decoded.trim();
  const rows = expandMaladaptiveTargetsFromProfile(profile);
  for (const { name } of rows) {
    if (name.trim() === t) return name.trim();
  }
  const tl = t.toLowerCase();
  for (const { name } of rows) {
    if (name.trim().toLowerCase() === tl) return name.trim();
  }
  return null;
}

function profileFromNameFallback(name: string): ClientProfileRow {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    dateOfBirth: "",
    gender: "",
    maladaptiveBehaviors: [],
    maladaptiveBehaviorTargets: [],
    replacementPrograms: [],
    interventions: [],
  };
}

const emptyMaladaptiveBase: ClientProfileRow = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  maladaptiveBehaviors: [],
  maladaptiveBehaviorTargets: [],
  replacementPrograms: [],
  interventions: [],
};

router.get("/clients", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const rows = await db.select().from(clientsTable).where(eq(clientsTable.companyId, companyId));

  const data = ListClientsResponse.parse({
    success: true,
    data: rows.map(clientRowToApiData),
    error: null,
  });

  res.json(data);
});

router.post("/clients", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  let body;
  try {
    body = CreateClientBody.parse(req.body);
  } catch {
    res.status(400).json({ success: false, error: "Invalid request body", messages: [] });
    return;
  }

  try {
    const mal = mergeMaladaptiveProfileFields({
      base: emptyMaladaptiveBase,
      behaviorsInput: body.maladaptiveBehaviors,
      targetsInput: body.maladaptiveBehaviorTargets,
    });
    const profile: ClientProfileRow = {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      dateOfBirth: body.dateOfBirth,
      gender: body.gender,
      maladaptiveBehaviors: mal.maladaptiveBehaviors,
      maladaptiveBehaviorTargets: mal.maladaptiveBehaviorTargets,
      replacementPrograms: body.replacementPrograms,
      interventions: body.interventions,
      assessmentFileName: body.assessmentFileName ?? undefined,
    };
    if (body.assessmentStructured != null) {
      const parsed = parseAssessmentStructured(body.assessmentStructured);
      if (!parsed) {
        res.status(400).json({
          success: false,
          error: "assessmentStructured could not be parsed",
          messages: [],
        });
        return;
      }
      const vi = validateAssessmentStructured(parsed);
      if (vi.length > 0) {
        res.status(400).json({
          success: false,
          error: "Invalid assessmentStructured",
          messages: vi,
        });
        return;
      }
      profile.assessmentStructured = parsed;
    }
    const name = `${profile.firstName} ${profile.lastName}`.trim() || "Client";

    const [row] = await db
      .insert(clientsTable)
      .values({
        companyId,
        name,
        ageBand: body.ageBand?.trim() || null,
        hasAssessment: body.hasAssessment,
        assessmentStatus: body.assessmentStatus,
        profile,
      })
      .returning();

    if (!row) {
      res.status(500).json({ success: false, error: "Failed to create client", messages: [] });
      return;
    }

    await syncReplacementProgramsFromProfile(row.id, companyId, profile);
    await pruneClientBehaviorProgramApprovals(row.id, profile);

    const data = GetClientResponse.parse({
      success: true,
      data: clientRowToApiData(row),
      error: null,
    });
    res.json(data);
  } catch (err) {
    console.error("[POST /clients] failed", err);
    const detail = extractDeepestDriverMessage(err);
    res.status(500).json({
      success: false,
      error: "Failed to create client",
      messages: [detail.length > 400 ? `${detail.slice(0, 400)}…` : detail],
    });
  }
});

router.get("/clients/:clientId/programs", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = ListClientProgramsParams.parse(req.params);

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  try {
    await syncReplacementProgramsFromProfile(client.id, companyId, client.profile);
  } catch (err) {
    console.error("[GET /clients/:id/programs] syncReplacementProgramsFromProfile", err);
    res.status(500).json({
      success: false,
      error: "Failed to sync replacement programs from client profile",
      messages: [],
    });
    return;
  }

  const sessionHours = Number(req.query.sessionHours) || 1;
  const minimumRequired = Math.max(sessionHours, 1);

  const programRows = await selectLinkedProgramsForClient(params.clientId, companyId);

  const data = ListClientProgramsResponse.parse({
    success: true,
    data: programRows.map((p) => ({
      id: p.id,
      companyId: p.companyId,
      name: p.name,
      type: normalizeProgramApiType(p.type),
      description: p.description ?? undefined,
    })),
    minimumRequired,
    error: null,
  });

  res.json(data);
});

router.put("/clients/:clientId/programs/:programId", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = UpdateClientProgramParams.parse(req.params);

  let body: z.infer<typeof UpdateClientProgramBody>;
  try {
    body = UpdateClientProgramBody.parse(req.body);
  } catch {
    res.status(400).json({ success: false, error: "Invalid request body", messages: [] });
    return;
  }

  const hasUpdate =
    body.name !== undefined || body.type !== undefined || body.description !== undefined;
  if (!hasUpdate) {
    res.status(400).json({
      success: false,
      error: "At least one of name, type, or description must be provided",
      messages: [],
    });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  const [row] = await db
    .select({
      linkId: clientProgramsTable.id,
      program: programsTable,
    })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(
      and(
        eq(clientProgramsTable.clientId, params.clientId),
        eq(clientProgramsTable.programId, params.programId),
        eq(programsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({
      success: false,
      error: "Program not found for this client",
      messages: [],
    });
    return;
  }

  const prevName = row.program.name;
  const nextName = body.name !== undefined ? body.name.trim() : prevName;
  if (body.name !== undefined && !nextName) {
    res.status(400).json({ success: false, error: "name cannot be empty", messages: [] });
    return;
  }

  if (nextName !== prevName) {
    const [nameTaken] = await db
      .select({ id: programsTable.id })
      .from(programsTable)
      .where(
        and(
          eq(programsTable.companyId, companyId),
          eq(programsTable.name, nextName),
          ne(programsTable.id, params.programId),
        ),
      )
      .limit(1);
    if (nameTaken) {
      res.status(409).json({
        success: false,
        error: "Another program in your company already uses this name",
        messages: [],
      });
      return;
    }
  }

  const nextType =
    body.type !== undefined ? body.type : normalizeProgramApiType(row.program.type);
  const nextDescription =
    body.description === undefined ? row.program.description : body.description;

  const [updatedProgram] = await db
    .update(programsTable)
    .set({
      name: nextName,
      type: nextType,
      description: nextDescription,
      updatedAt: new Date(),
    })
    .where(and(eq(programsTable.id, params.programId), eq(programsTable.companyId, companyId)))
    .returning();

  if (!updatedProgram) {
    res.status(500).json({ success: false, error: "Failed to update program", messages: [] });
    return;
  }

  if (nextName !== prevName) {
    const stored = (client.profile as ClientProfileRow | null) ?? profileFromNameFallback(client.name);
    const nextProfile = renameProgramNameInProfile(stored, prevName, nextName);
    await db
      .update(clientsTable)
      .set({ profile: nextProfile, updatedAt: new Date() })
      .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)));
  }

  const data = UpdateClientProgramResponse.parse({
    success: true,
    data: programRowToApiData(updatedProgram),
    error: null,
  });
  res.json(data);
});

router.delete("/clients/:clientId/programs/:programId", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = DeleteClientProgramParams.parse(req.params);

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  const [row] = await db
    .select({
      linkId: clientProgramsTable.id,
      programName: programsTable.name,
    })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(
      and(
        eq(clientProgramsTable.clientId, params.clientId),
        eq(clientProgramsTable.programId, params.programId),
        eq(programsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({
      success: false,
      error: "Program not found for this client",
      messages: [],
    });
    return;
  }

  await db.delete(clientProgramsTable).where(eq(clientProgramsTable.id, row.linkId));

  const stored = (client.profile as ClientProfileRow | null) ?? profileFromNameFallback(client.name);
  const nextProfile = removeProgramNameFromProfile(stored, row.programName);
  await db
    .update(clientsTable)
    .set({ profile: nextProfile, updatedAt: new Date() })
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)));

  await pruneClientBehaviorProgramApprovals(params.clientId, nextProfile);

  const data = DeleteClientProgramResponse.parse({
    success: true,
    data: { clientId: params.clientId, programId: params.programId },
    error: null,
  });
  res.json(data);
});

router.get("/clients/:clientId/behavior-program-approvals", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = ListClientBehaviorProgramApprovalsParams.parse(req.params);

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  let rows;
  try {
    rows = await db
      .select({
        behaviorLabel: clientBehaviorProgramApprovalsTable.behaviorLabel,
        programId: clientBehaviorProgramApprovalsTable.programId,
        programName: programsTable.name,
        matchType: clientBehaviorProgramApprovalsTable.matchType,
        requiresBcbaReview: clientBehaviorProgramApprovalsTable.requiresBcbaReview,
      })
      .from(clientBehaviorProgramApprovalsTable)
      .innerJoin(programsTable, eq(clientBehaviorProgramApprovalsTable.programId, programsTable.id))
      .where(
        and(
          eq(clientBehaviorProgramApprovalsTable.clientId, params.clientId),
          eq(programsTable.companyId, companyId),
        ),
      );
  } catch (err) {
    sendBehaviorApprovalsDbError(res, err, "GET /clients/:id/behavior-program-approvals");
    return;
  }

  const data = ListClientBehaviorProgramApprovalsResponse.parse({
    success: true,
    data: {
      items: rows.map((r) => ({
        behaviorLabel: r.behaviorLabel.trim(),
        programId: r.programId,
        programName: r.programName,
        matchType: r.matchType,
        requiresBcbaReview: r.requiresBcbaReview,
      })),
    },
    error: null,
  });
  res.json(data);
});

router.get("/clients/:clientId/replacement-programs", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = ListClientReplacementProgramsParams.parse(req.params);

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  try {
    await syncReplacementProgramsFromProfile(client.id, companyId, client.profile);
  } catch (err) {
    console.error("[GET /clients/:id/replacement-programs] sync", err);
    res.status(500).json({
      success: false,
      error: "Failed to sync replacement programs from client profile",
      messages: [],
    });
    return;
  }

  const programRows = await selectLinkedProgramsForClient(params.clientId, companyId);

  const data = ListClientReplacementProgramsResponse.parse({
    success: true,
    data: programRows.map((p) => ({
      id: p.id,
      companyId: p.companyId,
      name: p.name,
      type: normalizeProgramApiType(p.type),
      description: p.description ?? undefined,
    })),
    error: null,
  });
  res.json(data);
});

router.put("/clients/:clientId/behaviors/:behaviorLabel/approved-programs", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = PutClientBehaviorApprovedProgramsParams.parse(req.params);

  let body: z.infer<typeof PutClientBehaviorApprovedProgramsBody>;
  try {
    body = PutClientBehaviorApprovedProgramsBody.parse(req.body);
  } catch {
    res.status(400).json({ success: false, error: "Invalid request body", messages: [] });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  const profile = (client.profile as ClientProfileRow | null) ?? profileFromNameFallback(client.name);
  const canonicalBehavior = resolveCanonicalBehaviorLabel(params.behaviorLabel, profile);
  if (!canonicalBehavior) {
    res.status(404).json({
      success: false,
      error: "Behavior not found on this client's profile",
      messages: [],
    });
    return;
  }

  try {
    await syncReplacementProgramsFromProfile(client.id, companyId, client.profile);
  } catch (err) {
    console.error("[PUT behavior approved programs] sync", err);
    res.status(500).json({
      success: false,
      error: "Failed to sync replacement programs from client profile",
      messages: [],
    });
    return;
  }

  const linked = await selectLinkedProgramsForClient(params.clientId, companyId);
  const linkedIds = new Set(linked.map((p) => p.id));

  const byPid = new Map<
    number,
    { programId: number; matchType: string; requiresBcbaReview: boolean }
  >();
  for (const p of body.programs) {
    if (!linkedIds.has(p.programId)) {
      res.status(400).json({
        success: false,
        error: `Program ${p.programId} is not linked to this client`,
        messages: [],
      });
      return;
    }
    byPid.set(p.programId, {
      programId: p.programId,
      matchType: p.matchType,
      requiresBcbaReview: p.requiresBcbaReview ?? false,
    });
  }

  const now = new Date();
  let saved;
  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(clientBehaviorProgramApprovalsTable)
        .where(
          and(
            eq(clientBehaviorProgramApprovalsTable.clientId, params.clientId),
            eq(clientBehaviorProgramApprovalsTable.behaviorLabel, canonicalBehavior),
          ),
        );
      for (const row of byPid.values()) {
        await tx.insert(clientBehaviorProgramApprovalsTable).values({
          clientId: params.clientId,
          behaviorLabel: canonicalBehavior,
          programId: row.programId,
          matchType: row.matchType,
          requiresBcbaReview: row.requiresBcbaReview,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    saved = await db
      .select({
        behaviorLabel: clientBehaviorProgramApprovalsTable.behaviorLabel,
        programId: clientBehaviorProgramApprovalsTable.programId,
        programName: programsTable.name,
        matchType: clientBehaviorProgramApprovalsTable.matchType,
        requiresBcbaReview: clientBehaviorProgramApprovalsTable.requiresBcbaReview,
      })
      .from(clientBehaviorProgramApprovalsTable)
      .innerJoin(programsTable, eq(clientBehaviorProgramApprovalsTable.programId, programsTable.id))
      .where(
        and(
          eq(clientBehaviorProgramApprovalsTable.clientId, params.clientId),
          eq(clientBehaviorProgramApprovalsTable.behaviorLabel, canonicalBehavior),
          eq(programsTable.companyId, companyId),
        ),
      );
  } catch (err) {
    sendBehaviorApprovalsDbError(res, err, "PUT /clients/:id/behaviors/.../approved-programs");
    return;
  }

  const data = PutClientBehaviorApprovedProgramsResponse.parse({
    success: true,
    data: {
      behaviorLabel: canonicalBehavior.trim(),
      items: saved.map((r) => ({
        behaviorLabel: r.behaviorLabel.trim(),
        programId: r.programId,
        programName: r.programName,
        matchType: r.matchType,
        requiresBcbaReview: r.requiresBcbaReview,
      })),
    },
    error: null,
  });
  res.json(data);
});

router.get("/clients/:clientId", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = GetClientParams.parse(req.params);

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  try {
    await syncReplacementProgramsFromProfile(client.id, companyId, client.profile);
  } catch (err) {
    console.error("[clients/:clientId] syncReplacementProgramsFromProfile", err);
  }

  const data = GetClientResponse.parse({
    success: true,
    data: clientRowToApiData(client),
    error: null,
  });

  res.json(data);
});

router.post("/clients/:clientId/recommendations", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = CreateClientClinicalRecommendationParams.parse(req.params);

  let body: z.infer<typeof CreateClientClinicalRecommendationBody>;
  try {
    body = CreateClientClinicalRecommendationBody.parse(req.body);
  } catch {
    res.status(400).json({ success: false, error: "Invalid request body", messages: [] });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  const profile = (client.profile as ClientProfileRow | null | undefined) ?? null;
  const structured = getAssessmentStructuredFromProfile(profile);
  if (!structured) {
    res.status(422).json({
      success: false,
      error: "Structured assessment required",
      messages: [
        "Set profile.assessmentStructured (curated BIP allow-lists) via PATCH /clients/:clientId before requesting recommendations.",
      ],
    });
    return;
  }

  const structIssues = validateAssessmentStructured(structured);
  if (structIssues.length > 0) {
    res.status(422).json({
      success: false,
      error: "Invalid structured assessment on client profile",
      messages: structIssues,
    });
    return;
  }

  const result = computeClinicalRecommendation(structured, {
    behavior: body.behavior,
    behavior_topography: body.behavior_topography,
    operational_definition: body.operational_definition,
    function: body.function,
    severity_level: body.severity_level,
    is_dangerous: body.is_dangerous,
  });

  if (!result.ok) {
    const data = CreateClientClinicalRecommendationResponse.parse({
      success: false,
      data: null,
      error: result.error,
      messages: [],
    });
    res.status(200).json(data);
    return;
  }

  const data = CreateClientClinicalRecommendationResponse.parse({
    success: true,
    data: result.data,
    error: null,
  });
  res.json(data);
});

router.patch("/clients/:clientId", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = UpdateClientParams.parse(req.params);

  let body;
  try {
    body = UpdateClientBody.parse(req.body);
  } catch {
    res.status(400).json({ success: false, error: "Invalid request body", messages: [] });
    return;
  }

  try {
  const [existing] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  const stored = (existing.profile as ClientProfileRow | null | undefined) ?? null;
  const base: ClientProfileRow = stored ?? profileFromNameFallback(existing.name);

  const clearingAssessment = body.clearAssessment === true;

  let assessmentFileName: string | undefined = base.assessmentFileName;
  if (clearingAssessment) {
    assessmentFileName = undefined;
  } else if (body.assessmentFileName !== undefined) {
    assessmentFileName =
      body.assessmentFileName === null ? undefined : body.assessmentFileName;
  }

  let maladaptiveBehaviors = base.maladaptiveBehaviors;
  let maladaptiveBehaviorTargets = base.maladaptiveBehaviorTargets;
  if (body.maladaptiveBehaviors !== undefined || body.maladaptiveBehaviorTargets !== undefined) {
    const mal = mergeMaladaptiveProfileFields({
      base,
      behaviorsInput: body.maladaptiveBehaviors,
      targetsInput: body.maladaptiveBehaviorTargets,
    });
    maladaptiveBehaviors = mal.maladaptiveBehaviors;
    maladaptiveBehaviorTargets = mal.maladaptiveBehaviorTargets;
  }

  let assessmentStructuredNext: ClientProfileRow["assessmentStructured"] = base.assessmentStructured;
  if (clearingAssessment) {
    assessmentStructuredNext = null;
  } else if (body.assessmentStructured !== undefined) {
    if (body.assessmentStructured === null) {
      assessmentStructuredNext = null;
    } else {
      const parsed = parseAssessmentStructured(body.assessmentStructured);
      if (!parsed) {
        res.status(400).json({
          success: false,
          error: "assessmentStructured could not be parsed",
          messages: [],
        });
        return;
      }
      const vi = validateAssessmentStructured(parsed);
      if (vi.length > 0) {
        res.status(400).json({
          success: false,
          error: "Invalid assessmentStructured",
          messages: vi,
        });
        return;
      }
      assessmentStructuredNext = parsed;
    }
  }

  const nextProfile: ClientProfileRow = {
    ...base,
    firstName: body.firstName?.trim() ?? base.firstName,
    lastName: body.lastName?.trim() ?? base.lastName,
    dateOfBirth: body.dateOfBirth ?? base.dateOfBirth,
    gender: body.gender ?? base.gender,
    maladaptiveBehaviors,
    maladaptiveBehaviorTargets,
    replacementPrograms: body.replacementPrograms ?? base.replacementPrograms,
    interventions: body.interventions ?? base.interventions,
    assessmentFileName,
    assessmentStructured: assessmentStructuredNext,
  };

  if (clearingAssessment) {
    delete nextProfile.assessmentTextSnapshot;
  }

  const name =
    `${nextProfile.firstName} ${nextProfile.lastName}`.trim() || existing.name;

  const [updated] = await db
    .update(clientsTable)
    .set({
      name,
      ageBand: body.ageBand !== undefined ? body.ageBand?.trim() || null : existing.ageBand,
      hasAssessment: clearingAssessment ? false : (body.hasAssessment ?? existing.hasAssessment),
      assessmentStatus: (clearingAssessment
        ? "missing"
        : (body.assessmentStatus ?? existing.assessmentStatus)) as AssessmentStatus,
      profile: nextProfile,
      updatedAt: new Date(),
    })
    .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
    .returning();

  if (!updated) {
    res.status(500).json({ success: false, error: "Failed to update client", messages: [] });
    return;
  }

  await syncReplacementProgramsFromProfile(updated.id, companyId, nextProfile);
  await pruneClientBehaviorProgramApprovals(updated.id, nextProfile);

  const data = GetClientResponse.parse({
    success: true,
    data: clientRowToApiData(updated),
    error: null,
  });
  res.json(data);
  } catch (err) {
    console.error("[PATCH /clients/:clientId] failed", err);
    const detail = extractDeepestDriverMessage(err);
    res.status(500).json({
      success: false,
      error: "Failed to update client",
      messages: [detail.length > 400 ? `${detail.slice(0, 400)}…` : detail],
    });
  }
});

router.delete("/clients/:clientId", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = DeleteClientParams.parse(req.params);

  try {
    const [existing] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: "Client not found", messages: [] });
      return;
    }

    // Notes, client_programs, and client_behavior_program_approvals all use ON DELETE CASCADE
    // (see lib/db/src/schema), so a single delete on clients removes the dependent rows too.
    await db
      .delete(clientsTable)
      .where(and(eq(clientsTable.id, params.clientId), eq(clientsTable.companyId, companyId)));

    const data = DeleteClientResponse.parse({
      success: true,
      data: { clientId: params.clientId },
      error: null,
    });
    res.json(data);
  } catch (err) {
    console.error("[DELETE /clients/:clientId] failed", err);
    const detail = extractDeepestDriverMessage(err);
    res.status(500).json({
      success: false,
      error: "Failed to delete client",
      messages: [detail.length > 400 ? `${detail.slice(0, 400)}…` : detail],
    });
  }
});

export default router;
