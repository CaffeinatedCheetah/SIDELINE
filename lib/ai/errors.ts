export type AiErrorCode =
  | "AI_DISABLED"
  | "AUTHENTICATION"
  | "BUDGET_EXHAUSTED"
  | "CONFLICT"
  | "INSUFFICIENT_DATA"
  | "INVALID_OUTPUT"
  | "NOT_FOUND"
  | "NOT_FINAL"
  | "POLICY"
  | "PROVIDER"
  | "RATE_LIMIT"
  | "TIMEOUT";

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function classifyProviderError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : undefined;
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name.includes("Timeout"))
    return new AiError("TIMEOUT", "The AI provider timed out.", true);
  if (status === 401 || status === 403)
    return new AiError(
      "AUTHENTICATION",
      "The AI provider rejected its credentials.",
    );
  if (status === 429)
    return new AiError("RATE_LIMIT", "The AI provider is busy.", true);
  if (status && status >= 500)
    return new AiError("PROVIDER", "The AI provider is unavailable.", true);
  return new AiError("PROVIDER", "The AI provider request failed.");
}
