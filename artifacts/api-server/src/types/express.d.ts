import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
    companyId?: number;
    role?: "user" | "super_admin";
  }
}
