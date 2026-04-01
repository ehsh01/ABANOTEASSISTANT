import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import clientsRouter from "./clients";
import notesRouter from "./notes";
import assessmentExtractRouter from "./assessment-extract";
import clientAssessmentDocumentRouter from "./client-assessment-document";
import { requireAuth, rejectSuperAdminFromTenantData } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
// Mount at /admin only — do not use `router.use(adminRouter)` or `requireSuperAdmin`
// runs on every authenticated route (403 for normal users on /clients, /notes, etc.).
router.use("/admin", adminRouter);
router.use(rejectSuperAdminFromTenantData, clientsRouter);
router.use(rejectSuperAdminFromTenantData, clientAssessmentDocumentRouter);
router.use(rejectSuperAdminFromTenantData, assessmentExtractRouter);
router.use(rejectSuperAdminFromTenantData, notesRouter);

export default router;
