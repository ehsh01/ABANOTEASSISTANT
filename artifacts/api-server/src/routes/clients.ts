import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  ListClientsResponse,
  GetClientParams,
  GetClientResponse,
  ListClientProgramsParams,
  ListClientProgramsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { clientsTable, programsTable, clientProgramsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/clients", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const rows = await db.select().from(clientsTable).where(eq(clientsTable.companyId, companyId));

  const data = ListClientsResponse.parse({
    success: true,
    data: rows.map((c) => ({
      id: c.id,
      companyId: c.companyId,
      name: c.name,
      ageBand: c.ageBand ?? undefined,
      hasAssessment: c.hasAssessment,
      assessmentStatus: c.assessmentStatus as "uploaded" | "processing" | "ready" | "missing",
    })),
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
    data: {
      id: client.id,
      companyId: client.companyId,
      name: client.name,
      ageBand: client.ageBand ?? undefined,
      hasAssessment: client.hasAssessment,
      assessmentStatus: client.assessmentStatus as "uploaded" | "processing" | "ready" | "missing",
    },
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

export default router;
