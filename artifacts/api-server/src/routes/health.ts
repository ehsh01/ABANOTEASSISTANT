import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isOpenAINoteGenerationConfigured } from "../openai-notes";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const buildId =
    process.env.API_BUILD_ID?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    undefined;

  const data = HealthCheckResponse.parse({
    status: "ok",
    notesClinicalBodyPolicy: "openai_only",
    openaiConfigured: isOpenAINoteGenerationConfigured(),
    ...(buildId ? { buildId } : {}),
  });
  res.json(data);
});

export default router;
