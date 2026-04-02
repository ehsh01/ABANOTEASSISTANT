import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import {
  RegisterBody,
  RegisterResponse,
  LoginBody,
  LoginResponse,
  VerifyEmailBody,
  VerifyEmailResponse,
  ResendVerificationBody,
  ResendVerificationResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { companiesTable, usersTable } from "@workspace/db/schema";
import { signAuthToken, type UserRole } from "../middleware/auth";
import { roleForNewRegistration } from "../lib/super-admin";
import {
  generateRawVerificationToken,
  hashVerificationToken,
} from "../lib/verification-token";
import {
  appOrigin,
  isEmailConfigured,
  isVerificationDisabled,
  sendVerificationEmail,
} from "../lib/mailer";

function dbRoleToTokenRole(role: string | null | undefined): UserRole {
  return role === "super_admin" ? "super_admin" : "user";
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

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

  const emailConfigured = isEmailConfigured();
  const verificationDisabled = isVerificationDisabled();

  if (process.env.NODE_ENV === "production" && !emailConfigured && !verificationDisabled) {
    res.status(503).json({
      success: false,
      error:
        "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM (or set EMAIL_VERIFICATION_DISABLED=true only for non-production-style use).",
      messages: [],
    });
    return;
  }

  const needsVerification = emailConfigured && !verificationDisabled;

  const passwordHash = await bcrypt.hash(body.password, 10);
  const role = roleForNewRegistration(body.email);

  let rawToken: string | null = null;
  const tokenHash = needsVerification ? hashVerificationToken((rawToken = generateRawVerificationToken())) : null;
  const tokenExpires = needsVerification ? new Date(Date.now() + VERIFICATION_TTL_MS) : null;

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
          emailVerified: !needsVerification,
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: tokenExpires,
        })
        .returning();

      return { company, user };
    });

    if (needsVerification && rawToken) {
      try {
        await sendVerificationEmail({ to: body.email, rawToken });
      } catch (err) {
        console.error("verification email failed", err);
        res.status(500).json({
          success: false,
          error:
            "Your account was created, but we could not send the confirmation email. Try “Resend verification” from the sign-in page.",
          messages: [],
        });
        return;
      }

      const data = RegisterResponse.parse({
        success: true,
        data: {
          pendingEmailVerification: true,
          message: `We sent a confirmation link to ${body.email}. Open it to activate your account, then sign in.`,
          token: null,
          user: null,
          company: null,
        },
        error: null,
      });
      res.json(data);
      return;
    }

    const token = signAuthToken(
      result.user.id,
      result.user.companyId,
      dbRoleToTokenRole(result.user.role),
    );

    const data = RegisterResponse.parse({
      success: true,
      data: {
        pendingEmailVerification: false,
        message:
          process.env.NODE_ENV !== "production" && !emailConfigured
            ? "Signed in (email verification skipped: RESEND_API_KEY not set)."
            : "Your account is ready.",
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

router.post("/auth/verify-email", async (req, res) => {
  const body = VerifyEmailBody.parse(req.body);
  const hash = hashVerificationToken(body.token);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.emailVerificationTokenHash, hash))
    .limit(1);

  if (!user) {
    res.status(400).json({
      success: false,
      error: "Invalid or expired verification link.",
      messages: [],
    });
    return;
  }

  if (user.emailVerified) {
    res.json(
      VerifyEmailResponse.parse({
        success: true,
        message: "Email is already verified. You can sign in.",
        error: null,
      }),
    );
    return;
  }

  const exp = user.emailVerificationExpiresAt;
  if (!exp || exp.getTime() < Date.now()) {
    res.status(400).json({
      success: false,
      error: "This confirmation link has expired. Request a new one from the sign-in page.",
      messages: [],
    });
    return;
  }

  await db
    .update(usersTable)
    .set({
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  res.json(
    VerifyEmailResponse.parse({
      success: true,
      message: "Email verified. You can sign in.",
      error: null,
    }),
  );
});

router.post("/auth/resend-verification", async (req, res) => {
  const body = ResendVerificationBody.parse(req.body);

  const generic = ResendVerificationResponse.parse({
    success: true,
    message:
      "If an account exists for this email and is still awaiting confirmation, we sent a new link.",
    error: null,
  });

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, body.email))
    .limit(1);

  if (!user || user.emailVerified || !isEmailConfigured()) {
    res.json(generic);
    return;
  }

  const rawToken = generateRawVerificationToken();
  const tokenHash = hashVerificationToken(rawToken);
  const tokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS);

  await db
    .update(usersTable)
    .set({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: tokenExpires,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  try {
    await sendVerificationEmail({ to: user.email, rawToken });
  } catch (err) {
    console.error("resend verification email failed", err);
  }

  res.json(generic);
});

router.post("/auth/login", async (req, res) => {
  try {
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

    if (!user.emailVerified) {
      res.status(403).json({
        success: false,
        error:
          "Please confirm your email before signing in. Check your inbox or use “Resend confirmation” on the registration page.",
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
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: "Invalid request",
        messages: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      });
      return;
    }
    console.error("[auth/login]", err);
    const exposeDetail = process.env.NODE_ENV !== "production";
    res.status(500).json({
      success: false,
      error: "Login temporarily unavailable. Please try again.",
      messages:
        exposeDetail && err instanceof Error
          ? [err.message]
          : [],
    });
  }
});

export default router;
