import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  ListClientsResponse,
  GetClientParams,
  GetClientResponse,
  CreateClientBody,
  UpdateClientParams,
  UpdateClientBody,
  ListClientProgramsParams,
  ListClientProgramsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  clientsTable,
  programsTable,
  clientProgramsTable,
  type ClientProfileRow,
} from "@workspace/db/schema";
import { clientRowToApiData } from "../client-profile-api";

const router: IRouter = Router();

type AssessmentStatus = "uploaded" | "processing" | "ready" | "missing";

/**
 * Wizard and note generation use `client_programs` + `programs` rows.
 * Replacement program names live on `client.profile.replacementPrograms` from the intake form;
 * ensure each name has a matching program row (per company) and is linked to the client.
 */
async function syncReplacementProgramsFromProfile(
  clientId: number,
  companyId: number,
  profile: ClientProfileRow | null | undefined,
): Promise<void> {
  const raw = profile?.replacementPrograms ?? [];
  const names = [...new Set(raw.map((n) => n.trim()).filter((n) => n.length > 0))];
  if (names.length === 0) return;

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

  await syncReplacementProgramsFromProfile(
    client.id,
    companyId,
    client.profile as ClientProfileRow | null | undefined,
  );

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
      type: p.type as "primary" | "supplemental",
      description: p.description ?? undefined,
    })),
    minimumRequired,
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
