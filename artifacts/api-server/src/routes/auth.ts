import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import {
  RegisterBody,
  RegisterResponse,
  LoginBody,
  LoginResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { companiesTable, usersTable } from "@workspace/db/schema";
import { signAuthToken, type UserRole } from "../middleware/auth";
import { roleForNewRegistration } from "../lib/super-admin";

function dbRoleToTokenRole(role: string | null | undefined): UserRole {
  return role === "super_admin" ? "super_admin" : "user";
}

const router: IRouter = Router();

router.post("/auth/register", async (req, res) => {
  const body = RegisterBody.parse(req.body);

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, body.email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({
      success: false,
      error: "Email already registered",
      messages: [],
    });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const role = roleForNewRegistration(body.email);

  try {
    const result = await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companiesTable)
        .values({
          name: body.companyName,
          address: body.companyAddress ?? null,
          phone: body.companyPhone ?? null,
          email: body.companyEmail ?? null,
        })
        .returning();

      const [user] = await tx
        .insert(usersTable)
        .values({
          email: body.email,
          passwordHash,
          companyId: company.id,
          role,
        })
        .returning();

      return { company, user };
    });

    const token = signAuthToken(result.user.id, result.user.companyId, dbRoleToTokenRole(result.user.role));

    const data = RegisterResponse.parse({
      success: true,
      data: {
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          companyId: result.user.companyId,
          role: dbRoleToTokenRole(result.user.role),
        },
        company: {
          id: result.company.id,
          name: result.company.name,
          address: result.company.address ?? undefined,
          phone: result.company.phone ?? undefined,
          email: result.company.email ?? undefined,
          freeUsage: result.company.freeUsage,
        },
      },
      error: null,
    });

    res.json(data);
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({
      success: false,
      error: "Registration failed",
      messages: [],
    });
  }
});

router.post("/auth/login", async (req, res) => {
  const body = LoginBody.parse(req.body);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, body.email)).limit(1);

  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    res.status(401).json({
      success: false,
      error: "Invalid credentials",
      messages: [],
    });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, user.companyId))
    .limit(1);

  if (!company) {
    res.status(500).json({
      success: false,
      error: "Company not found for user",
      messages: [],
    });
    return;
  }

  const tokenRole = dbRoleToTokenRole(user.role);
  const token = signAuthToken(user.id, user.companyId, tokenRole);

  const data = LoginResponse.parse({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        companyId: user.companyId,
        role: tokenRole,
      },
      company: {
        id: company.id,
        name: company.name,
        address: company.address ?? undefined,
        phone: company.phone ?? undefined,
        email: company.email ?? undefined,
        freeUsage: company.freeUsage,
      },
    },
    error: null,
  });

  res.json(data);
});

export default router;
