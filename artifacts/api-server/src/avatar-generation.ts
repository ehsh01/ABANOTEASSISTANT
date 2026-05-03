/**
 * AI-generated **stylized cartoon** avatar for a client profile.
 *
 * Privacy & safety choices (intentional):
 * - We render an **illustrated / cartoon** portrait, never photorealistic, so the avatar stays clearly
 *   stylized and does not impersonate the actual learner. This is deliberately friendly for HIPAA-adjacent
 *   contexts and minors.
 * - We pass only the **first name**, **approximate age** (years), and **gender** to the model. The first
 *   name supplies cultural / ethnic cues so the avatar can resemble likely appearance; the last name is
 *   omitted. The model never sees DOB, behaviors, programs, interventions, or assessment text.
 * - The model is told explicitly to avoid text, logos, watermarks, photo realism, and uncanny detail.
 */

import OpenAI from "openai";
import crypto from "crypto";

/** Default model. Override with `OPENAI_AVATAR_MODEL` (e.g. `dall-e-3`) when an org isn't verified. */
const DEFAULT_AVATAR_MODEL = "gpt-image-1";

/** Quality knob — `low` keeps the PNG ~50–150 KB; `medium`/`high` trade size for crispness. */
const DEFAULT_AVATAR_QUALITY = "low" as const;

/** Smallest gpt-image-1 size; PNG output. */
const DEFAULT_AVATAR_SIZE = "1024x1024" as const;

export type GenerateClientAvatarInput = {
  firstName: string;
  /** Date of birth in `MM/dd/yyyy` (intake form) or `yyyy-MM-dd`; used only to compute approximate age. */
  dateOfBirth?: string | null;
  /** Free-form gender label from the intake form (e.g. "Male", "Female", "Non-binary", "Prefer not to say"). */
  gender?: string | null;
};

export type GeneratedAvatar = {
  /** Raw PNG bytes (Buffer). */
  png: Buffer;
  /** Base64-encoded PNG (no `data:` prefix) — convenient for direct DB storage. */
  pngBase64: string;
  /** Prompt actually sent to the model (for audit / debug logs). */
  prompt: string;
  /** Model name used. */
  model: string;
};

/**
 * Compute a coarse age (in whole years) from a `MM/dd/yyyy` or `yyyy-MM-dd` string. Returns `null` when
 * the date is missing or unparseable. Clamps to a safe `[0, 100]` band so a typo doesn't propagate.
 */
export function ageYearsFromDateOfBirth(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const t = String(dob).trim();
  if (!t) return null;

  let y: number, m: number, d: number;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
    [y, m, d] = t.split("-").map(Number);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) {
    const [mo, da, yr] = t.split("/").map(Number);
    y = yr;
    m = mo;
    d = da;
  } else {
    return null;
  }
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - y;
  const md = today.getMonth() - (m - 1);
  if (md < 0 || (md === 0 && today.getDate() < d)) age--;
  if (age < 0 || age > 100) return null;
  return age;
}

/**
 * Map free-form gender input to a small allow-list of phrases the prompt can use without leaking
 * speculative attributes. "Prefer not to say" / unknown returns the neutral phrase "child" / "young person".
 */
function describeGender(raw: string | null | undefined, ageYears: number | null): string {
  const t = (raw ?? "").trim().toLowerCase();
  const isYoungChild = ageYears !== null && ageYears < 13;
  const isTeen = ageYears !== null && ageYears >= 13 && ageYears <= 19;
  const isAdult = ageYears !== null && ageYears > 19;
  const noun = isYoungChild ? "child" : isTeen ? "teenager" : isAdult ? "young adult" : "young person";
  if (t === "male" || t === "m") return `${isYoungChild ? "boy" : noun}`;
  if (t === "female" || t === "f") return `${isYoungChild ? "girl" : noun}`;
  if (t.includes("non-binary") || t === "nonbinary" || t === "nb") return `${noun} (gender-neutral presentation)`;
  return noun;
}

/**
 * Sanitize the first name for inclusion in the prompt. Strips anything that isn't letters/spaces/hyphens/apostrophes
 * (so a model-prompt-injection attempt via the name field can't introduce control sequences). Caps length at 32.
 */
function sanitizeFirstName(raw: string): string {
  const cleaned = String(raw ?? "")
    .replace(/[^A-Za-z\u00C0-\u024F\u1E00-\u1EFF\s'\-]/g, "")
    .trim()
    .slice(0, 32);
  return cleaned;
}

export function buildAvatarPrompt(input: GenerateClientAvatarInput): string {
  const firstNameSafe = sanitizeFirstName(input.firstName);
  const ageYears = ageYearsFromDateOfBirth(input.dateOfBirth ?? null);
  const ageClause =
    ageYears === null ? "approximately school-aged" : `approximately ${ageYears} years old`;
  const genderClause = describeGender(input.gender, ageYears);

  // Keep wording explicit about cartoon / illustrated style so the model never tries photorealism.
  return [
    `Create a friendly, soft cartoon-style illustrated portrait avatar for a profile picture in a children's behavior therapy app.`,
    ``,
    `Subject:`,
    `- A ${ageClause} ${genderClause}.`,
    firstNameSafe ? `- The first name is "${firstNameSafe}". Use the name only as a gentle cultural / ethnic cue when choosing skin tone, hair color, hair style, and eye color so the avatar resembles plausible appearance for that name and that age. If the name is culturally ambiguous, use a neutral mix.` : ``,
    ``,
    `Style requirements (mandatory):`,
    `- Cartoon / illustration / flat colors / simple shapes. NOT photorealistic. NOT a real photo. Avoid uncanny detail.`,
    `- Head-and-shoulders portrait, centered, facing forward, gentle smile, warm and approachable.`,
    `- Solid soft pastel background.`,
    `- No text, no letters, no logos, no watermarks, no name overlays, no captions.`,
    `- Professional, dignified, clinically appropriate, suitable for a child's profile in a healthcare app.`,
    `- Square composition.`,
    ``,
    `Output: a single PNG image, square aspect ratio.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveAvatarModel(): string {
  return process.env["OPENAI_AVATAR_MODEL"]?.trim() || DEFAULT_AVATAR_MODEL;
}

/**
 * Generate a single AI avatar for `input` and return the PNG bytes (raw + base64). Throws on API errors.
 *
 * The function is intentionally synchronous from the caller's perspective (no streaming) so the callers
 * can treat it as a one-shot RPC — this keeps the route handlers simple. Callers that want fire-and-forget
 * behaviour should call this without awaiting.
 */
export async function generateClientAvatar(
  input: GenerateClientAvatarInput,
): Promise<GeneratedAvatar> {
  const apiKey = process.env["OPENAI_API_KEY"]?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!input.firstName?.trim()) {
    throw new Error("firstName is required to generate an avatar");
  }

  const client = new OpenAI({ apiKey });
  const model = resolveAvatarModel();
  const prompt = buildAvatarPrompt(input);

  const params: Parameters<typeof client.images.generate>[0] = {
    model,
    prompt,
    size: DEFAULT_AVATAR_SIZE,
    n: 1,
  };
  // gpt-image-1 supports a `quality` knob; older `dall-e-*` models silently reject it. We keep it
  // optional so an env-pinned `dall-e-3` fallback continues to work without extra branching here.
  if (model === DEFAULT_AVATAR_MODEL) {
    (params as unknown as Record<string, unknown>)["quality"] = DEFAULT_AVATAR_QUALITY;
  }

  const result = await client.images.generate(params);

  const first = result.data?.[0];
  const b64 = first?.b64_json;
  if (!b64) {
    throw new Error("Image model returned no b64_json payload");
  }
  const png = Buffer.from(b64, "base64");
  return { png, pngBase64: b64, prompt, model };
}

/**
 * HMAC-signed URL helpers so an `<img src=…>` tag can fetch the avatar without sending the JWT bearer
 * header. The token binds (clientId, avatarUpdatedAt-unix-ms) so any avatar regeneration invalidates
 * outstanding URLs. We sign with `JWT_SECRET` (already required for tenant routes); a missing secret
 * is a hard error elsewhere in the app, so we don't add a separate avatar secret.
 */
function avatarSigningSecret(): string {
  const s = process.env["JWT_SECRET"]?.trim();
  if (!s) {
    throw new Error(
      "JWT_SECRET is not configured; avatar URL signing is unavailable. Set JWT_SECRET in the API env.",
    );
  }
  return s;
}

/** Stable signing payload: `clientId|updatedAtUnixMs`. */
function avatarSignaturePayload(clientId: number, updatedAtMs: number): string {
  return `${clientId}|${updatedAtMs}`;
}

/** Compute the URL-safe HMAC token for an avatar URL. */
export function signAvatarToken(clientId: number, updatedAt: Date): string {
  const updatedAtMs = updatedAt.getTime();
  const mac = crypto.createHmac("sha256", avatarSigningSecret());
  mac.update(avatarSignaturePayload(clientId, updatedAtMs));
  return mac.digest("base64url");
}

/** Constant-time compare a candidate token against the expected one. Returns false on any input issue. */
export function verifyAvatarToken(
  clientId: number,
  updatedAtMs: number,
  candidate: string,
): boolean {
  if (!candidate || !Number.isFinite(updatedAtMs)) return false;
  let expected: string;
  try {
    const mac = crypto.createHmac("sha256", avatarSigningSecret());
    mac.update(avatarSignaturePayload(clientId, updatedAtMs));
    expected = mac.digest("base64url");
  } catch {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Build the public avatar URL surfaced on `Client` API responses. The browser uses this directly in
 * `<img src=…>`; the GET route is auth-free but signed (see `verifyAvatarToken`). Returns `null` when
 * the client has no avatar on file yet.
 */
export function buildAvatarUrl(clientId: number, avatarUpdatedAt: Date | null | undefined): string | null {
  if (!avatarUpdatedAt) return null;
  const ms = avatarUpdatedAt.getTime();
  const token = signAvatarToken(clientId, avatarUpdatedAt);
  return `/api/clients/${clientId}/avatar?v=${ms}&token=${token}`;
}
