import { rateLimit } from "express-rate-limit";
import { readPositiveIntEnv, type AiFeature } from "./ai-config";

const MAX_ENV: Record<AiFeature, { name: string; fallback: number }> = {
  note: { name: "NOTE_AI_RATE_LIMIT_MAX", fallback: 10 },
  assessment: { name: "ASSESSMENT_AI_RATE_LIMIT_MAX", fallback: 5 },
  avatar: { name: "AVATAR_AI_RATE_LIMIT_MAX", fallback: 5 },
};

/** Per-user fixed-window limiter for explicit AI mutation routes. */
export function aiRateLimit(feature: AiFeature) {
  const max = MAX_ENV[feature];
  return rateLimit({
    windowMs: readPositiveIntEnv("AI_RATE_LIMIT_WINDOW_MS", 60_000),
    limit: readPositiveIntEnv(max.name, max.fallback),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.userId ?? "unauthenticated"}`,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: "Too many AI requests. Please wait a moment and try again.",
        messages: [],
      });
    },
  });
}
