export type AiFeature = "note" | "assessment" | "avatar";

const FEATURE_SWITCH: Record<AiFeature, string> = {
  note: "NOTE_AI_ENABLED",
  assessment: "ASSESSMENT_AI_ENABLED",
  avatar: "AVATAR_AI_ENABLED",
};

export class AiFeatureDisabledError extends Error {
  readonly status = 503;

  constructor(readonly feature: AiFeature) {
    super("AI is turned off.");
    this.name = "AiFeatureDisabledError";
  }
}

export class AiLimitExceededError extends Error {
  readonly status = 429;

  constructor(
    message = "The daily AI limit has been reached. Please try again tomorrow.",
  ) {
    super(message);
    this.name = "AiLimitExceededError";
  }
}

export class AiProviderNotConfiguredError extends Error {
  readonly status = 503;

  constructor() {
    super("AI is not configured on the server.");
    this.name = "AiProviderNotConfiguredError";
  }
}

/** Only the exact, case-insensitive value `true` enables a switch. */
export function isAiFeatureEnabled(feature: AiFeature): boolean {
  return (
    process.env.AI_ENABLED?.trim().toLowerCase() === "true" &&
    process.env[FEATURE_SWITCH[feature]]?.trim().toLowerCase() === "true"
  );
}

export function assertAiFeatureEnabled(feature: AiFeature): void {
  if (!isAiFeatureEnabled(feature)) throw new AiFeatureDisabledError(feature);
}

export function assertAiProviderConfigured(feature: AiFeature): void {
  assertAiFeatureEnabled(feature);
  if (!process.env.OPENAI_API_KEY?.trim())
    throw new AiProviderNotConfiguredError();
}

export function readPositiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]?.trim() ?? "");
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function readNonNegativeIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]?.trim() ?? "");
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function readPositiveNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]?.trim() ?? "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function aiHttpError(error: unknown): {
  status: 429 | 503 | null;
  error: string;
} {
  if (
    error instanceof AiFeatureDisabledError ||
    error instanceof AiProviderNotConfiguredError
  ) {
    return { status: 503, error: error.message };
  }
  if (error instanceof AiLimitExceededError) {
    return { status: 429, error: error.message };
  }
  return {
    status: null,
    error: error instanceof Error ? error.message : "AI request failed",
  };
}
