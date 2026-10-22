import { ApiError } from "@workspace/api-client-react";

export function formatAiFeatureFailure(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof ApiError &&
    error.data &&
    typeof error.data === "object"
  ) {
    const apiError = (error.data as { error?: unknown }).error;
    if (typeof apiError === "string" && apiError.trim()) {
      if (apiError.trim() === "AI is turned off.") {
        return "AI is turned off. You can continue using the rest of the app.";
      }
      return apiError.trim();
    }
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}
