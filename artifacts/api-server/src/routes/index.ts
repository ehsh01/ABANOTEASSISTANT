import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import clientsRouter from "./clients";
import notesRouter from "./notes";
import assessmentExtractRouter from "./assessment-extract";
import clientAssessmentDocumentRouter from "./client-assessment-document";
import {
  clientAvatarPublicRouter,
  clientAvatarTenantRouter,
} from "./client-avatar";
import { requireAuth, rejectSuperAdminFromTenantData } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// The avatar GET route uses an HMAC-signed URL token instead of a Bearer header (so an HTML <img>
// tag can fetch it). Mount it BEFORE `requireAuth` so the JWT middleware doesn't 401 it.
router.use(clientAvatarPublicRouter);
router.use(requireAuth);
// Mount at /admin only — do not use `router.use(adminRouter)` or `requireSuperAdmin`
// runs on every authenticated route (403 for normal users on /clients, /notes, etc.).
router.use("/admin", adminRouter);
router.use(rejectSuperAdminFromTenantData, clientsRouter);
router.use(rejectSuperAdminFromTenantData, clientAvatarTenantRouter);
router.use(rejectSuperAdminFromTenantData, clientAssessmentDocumentRouter);
router.use(rejectSuperAdminFromTenantData, assessmentExtractRouter);
router.use(rejectSuperAdminFromTenantData, notesRouter);

export default router;
