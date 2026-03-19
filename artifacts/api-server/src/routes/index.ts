import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(notesRouter);

export default router;
