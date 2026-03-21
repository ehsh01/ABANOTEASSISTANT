import { Router, type IRouter } from "express";
import { count, eq } from "drizzle-orm";
import {
  ListAdminCompaniesResponse,
  ListAdminUsersResponse,
  PatchAdminCompanyParams,
  PatchAdminCompanyBody,
  PatchAdminCompanyResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { companiesTable, usersTable } from "@workspace/db/schema";
import { requireSuperAdmin } from "../middleware/auth";

const router: IRouter = Router();

router.use(requireSuperAdmin);

router.get("/admin/users", async (_req, res) => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      companyId: usersTable.companyId,
      companyName: companiesTable.name,
      role: usersTable.role,
      emailVerified: usersTable.emailVerified,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(companiesTable, eq(usersTable.companyId, companiesTable.id));

  const data = ListAdminUsersResponse.parse({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      email: r.email,
      companyId: r.companyId,
      companyName: r.companyName,
      role: r.role === "super_admin" ? ("super_admin" as const) : ("user" as const),
      emailVerified: r.emailVerified,
      createdAt: r.createdAt.toISOString(),
    })),
    error: null,
  });

  res.json(data);
});

router.get("/admin/companies", async (_req, res) => {
  const companies = await db.select().from(companiesTable);

  const userCounts = await db
    .select({
      companyId: usersTable.companyId,
      n: count(usersTable.id),
    })
    .from(usersTable)
    .groupBy(usersTable.companyId);

  const countByCompany = new Map(userCounts.map((r) => [r.companyId, Number(r.n)]));

  const data = ListAdminCompaniesResponse.parse({
    success: true,
    data: companies.map((c) => ({
      id: c.id,
      name: c.name,
      freeUsage: c.freeUsage,
      userCount: countByCompany.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    })),
    error: null,
  });

  res.json(data);
});

router.patch("/admin/companies/:companyId", async (req, res) => {
  const { companyId } = PatchAdminCompanyParams.parse(req.params);
  const body = PatchAdminCompanyBody.parse(req.body);

  const [updated] = await db
    .update(companiesTable)
    .set({ freeUsage: body.freeUsage, updatedAt: new Date() })
    .where(eq(companiesTable.id, companyId))
    .returning();

  if (!updated) {
    res.status(404).json({ success: false, error: "Company not found", messages: [] });
    return;
  }

  const [agg] = await db
    .select({ n: count(usersTable.id) })
    .from(usersTable)
    .where(eq(usersTable.companyId, companyId));

  const userCount = Number(agg?.n ?? 0);

  const data = PatchAdminCompanyResponse.parse({
    success: true,
    data: {
      id: updated.id,
      name: updated.name,
      freeUsage: updated.freeUsage,
      userCount,
      createdAt: updated.createdAt.toISOString(),
    },
    error: null,
  });

  res.json(data);
});

export default router;
