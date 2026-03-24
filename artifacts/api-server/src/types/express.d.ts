/**
 * Augment Express.Request for auth middleware (Express 5 + @types/express 5 use
 * `export interface Request extends Express.Request`; global merging is reliable).
 */
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      companyId?: number;
      role?: "user" | "super_admin";
    }
  }
}

export {};
