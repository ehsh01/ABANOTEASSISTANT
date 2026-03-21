import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import clientsRouter from "./clients";
import notesRouter from "./notes";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(adminRouter);
router.use(clientsRouter);
router.use(notesRouter);

export default router;
