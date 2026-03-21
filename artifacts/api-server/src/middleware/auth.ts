import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type UserRole = "user" | "super_admin";

type JwtPayload = {
  userId: number;
  companyId: number;
  role?: UserRole;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required for authentication");
  }
  return secret;
}

export function signAuthToken(
  userId: number,
  companyId: number,
  role: UserRole = "user",
): string {
  return jwt.sign({ userId, companyId, role }, getJwtSecret(), { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    getJwtSecret();
  } catch {
    res.status(500).json({
      success: false,
      error: "Server authentication is not configured",
      messages: [],
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (typeof payload.userId !== "number" || typeof payload.companyId !== "number") {
      res.status(401).json({ success: false, error: "Invalid token", messages: [] });
      return;
    }
    const role: UserRole =
      payload.role === "super_admin" || payload.role === "user" ? payload.role : "user";
    req.userId = payload.userId;
    req.companyId = payload.companyId;
    req.role = role;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token", messages: [] });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.role !== "super_admin") {
    res.status(403).json({
      success: false,
      error: "Forbidden",
      messages: ["Super admin access required"],
    });
    return;
  }
  next();
}

/**
 * Super admins manage companies and user accounts only — not clinical data (clients, notes).
 */
export function rejectSuperAdminFromTenantData(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.role === "super_admin") {
    res.status(403).json({
      success: false,
      error:
        "Super admins cannot access clients or notes. Sign in as a company user, or use the Admin console for companies and accounts.",
      messages: [],
    });
    return;
  }
  next();
}
