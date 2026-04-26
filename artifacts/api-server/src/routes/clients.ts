import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import {
  ListClientsResponse,
  GetClientParams,
  GetClientResponse,
  CreateClientBody,
  UpdateClientParams,
  UpdateClientBody,
  ListClientProgramsParams,
  ListClientProgramsResponse,
  UpdateClientProgramParams,
  UpdateClientProgramBody,
  UpdateClientProgramResponse,
  DeleteClientProgramParams,
  DeleteClientProgramResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  clientsTable,
  programsTable,
  clientProgramsTable,
  type ClientProfileRow,
} from "@workspace/db/schema";
import { clientRowToApiData } from "../client-profile-api";
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

function profileFromNameFallback(name: string): ClientProfileRow {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    dateOfBirth: "",
    gender: "",
    maladaptiveBehaviors: [],
    replacementPrograms: [],
    interventions: [],
  };
}

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

  const profile: ClientProfileRow = {
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    dateOfBirth: body.dateOfBirth,
    gender: body.gender,
    maladaptiveBehaviors: body.maladaptiveBehaviors,
    replacementPrograms: body.replacementPrograms,
    interventions: body.interventions,
    assessmentFileName: body.assessmentFileName ?? undefined,
  };
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

  const data = GetClientResponse.parse({
    success: true,
    data: clientRowToApiData(row),
    error: null,
  });
  res.json(data);
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

  const programRows = await db
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
        eq(clientProgramsTable.clientId, params.clientId),
        eq(programsTable.companyId, companyId),
      ),
    );

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

  const data = DeleteClientProgramResponse.parse({
    success: true,
    data: { clientId: params.clientId, programId: params.programId },
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

  let assessmentFileName: string | undefined = base.assessmentFileName;
  if (body.assessmentFileName !== undefined) {
    assessmentFileName =
      body.assessmentFileName === null ? undefined : body.assessmentFileName;
  }

  const nextProfile: ClientProfileRow = {
    ...base,
    firstName: body.firstName?.trim() ?? base.firstName,
    lastName: body.lastName?.trim() ?? base.lastName,
    dateOfBirth: body.dateOfBirth ?? base.dateOfBirth,
    gender: body.gender ?? base.gender,
    maladaptiveBehaviors: body.maladaptiveBehaviors ?? base.maladaptiveBehaviors,
    replacementPrograms: body.replacementPrograms ?? base.replacementPrograms,
    interventions: body.interventions ?? base.interventions,
    assessmentFileName,
  };

  const name =
    `${nextProfile.firstName} ${nextProfile.lastName}`.trim() || existing.name;

  const [updated] = await db
    .update(clientsTable)
    .set({
      name,
      ageBand: body.ageBand !== undefined ? body.ageBand?.trim() || null : existing.ageBand,
      hasAssessment: body.hasAssessment ?? existing.hasAssessment,
      assessmentStatus: (body.assessmentStatus ?? existing.assessmentStatus) as AssessmentStatus,
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

  const data = GetClientResponse.parse({
    success: true,
    data: clientRowToApiData(updated),
    error: null,
  });
  res.json(data);
});

export default router;
