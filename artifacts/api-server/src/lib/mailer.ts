import { Resend } from "resend";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function isVerificationDisabled(): boolean {
  return process.env.EMAIL_VERIFICATION_DISABLED === "true";
}

/**
 * Public URL of the SPA (no trailing slash), e.g. https://app.example.com or http://localhost:5173
 */
export function appOrigin(): string {
  return (process.env.APP_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
}

export async function sendVerificationEmail(params: {
  to: string;
  rawToken: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const resend = new Resend(key);
  const basePath = (process.env.APP_BASE_PATH ?? "").replace(/\/$/, "");
  const verifyPath = `${basePath}/verify-email?token=${encodeURIComponent(params.rawToken)}`;
  const url = `${appOrigin()}${verifyPath}`;

  const from =
    process.env.EMAIL_FROM?.trim() ?? "ABA Note Assistant <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: "Confirm your email for ABA Note Assistant",
    html: `<p>Thanks for registering.</p>
<p><a href="${url}">Confirm your email address</a></p>
<p>If the button does not work, copy and paste this link into your browser:</p>
<p style="word-break:break-all">${url}</p>
<p>This link expires in 24 hours.</p>`,
  });

  if (error) {
    throw new Error(error.message);
  }
}
