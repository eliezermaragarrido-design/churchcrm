export function openAIBillingMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const failure = error as { status?: number; code?: string; type?: string };
  if (failure.status !== 429 || !(
    ["credit_balance_exhausted", "insufficient_quota"].includes(failure.code || "") ||
    failure.type === "insufficient_quota"
  )) return null;
  return "OpenAI rejected this application's API key because of its billing quota. If you already added credit, check that the key belongs to the same organization and project as the funded account, check its usage limits, and allow a few minutes for a recent payment to update before retrying. This application cannot read your billing balance.";
}
