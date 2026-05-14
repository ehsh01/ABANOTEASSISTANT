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

router.get("/users", async (_req, res) => {
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

type BillingModeLiteral = "complimentary" | "trial" | "subscription" | "suspended";

function normalizeBillingMode(raw: string | null | undefined): BillingModeLiteral {
  return raw === "complimentary" || raw === "trial" || raw === "suspended"
    ? raw
    : "subscription";
}

router.get("/companies", async (_req, res) => {
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
      billingMode: normalizeBillingMode(c.billingMode),
      subscriptionStatus: c.subscriptionStatus ?? null,
      stripeCustomerId: c.stripeCustomerId ?? null,
      currentPeriodEnd: c.currentPeriodEnd?.toISOString() ?? null,
      userCount: countByCompany.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    })),
    error: null,
  });

  res.json(data);
});

router.patch("/companies/:companyId", async (req, res) => {
  const { companyId } = PatchAdminCompanyParams.parse(req.params);
  const body = PatchAdminCompanyBody.parse(req.body);

  // Patch only the explicitly-provided fields so legacy `{ freeUsage }` calls still work and we
  // don't accidentally null out billingMode when an older client posts without it.
  const updates: Partial<typeof companiesTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.freeUsage === "boolean") {
    updates.freeUsage = body.freeUsage;
  }
  if (
    body.billingMode === "complimentary" ||
    body.billingMode === "trial" ||
    body.billingMode === "subscription" ||
    body.billingMode === "suspended"
  ) {
    updates.billingMode = body.billingMode;
  }

  const [updated] = await db
    .update(companiesTable)
    .set(updates)
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
      billingMode: normalizeBillingMode(updated.billingMode),
      subscriptionStatus: updated.subscriptionStatus ?? null,
      stripeCustomerId: updated.stripeCustomerId ?? null,
      currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      userCount,
      createdAt: updated.createdAt.toISOString(),
    },
    error: null,
  });

  res.json(data);
});

export default router;
