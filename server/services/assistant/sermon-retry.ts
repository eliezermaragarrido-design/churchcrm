import { openAIBillingMessage } from "@/lib/openai-errors";

export function sermonRetry(error: unknown, failures: number, now = Date.now()) {
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : String(error);
  const permanent = !!openAIBillingMessage(error) || [401, 403, 404].includes(status || 0) || /not configured|billing quota|no credits|credit_balance_exhausted|model is unavailable/i.test(message);
  const retry = !permanent && failures <= 12;
  return { retry, retryAt: retry ? now + Math.min(120_000, 5000 * 2 ** (failures - 1)) : null };
}
