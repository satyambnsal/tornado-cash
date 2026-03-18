/**
 * Generic helper to obtain a Turnstile token for form submission.
 * Uses getter functions so callers can pass refs without this module depending on Turnstile types.
 * Reusable by any feature that needs to call an endpoint requiring a Turnstile token (e.g. zk-email).
 */

const DEFAULT_TURNSTILE_WAIT_MS = 10_000;

export interface GetTurnstileTokenOptions {
  /** Trigger the Turnstile challenge (e.g. execute()). */
  execute: () => Promise<void>;
  /** Get the current token from the widget (e.g. getResponse()). */
  getResponse: () => string;
  /** Get the token from a ref updated by onSuccess callback. */
  getRefToken: () => string | null;
  /** Max time to wait for token after execute (ms). Default 10s. */
  timeoutMs?: number;
}

/**
 * Execute the Turnstile challenge and wait for a token (from getRefToken or getResponse).
 * Polls until token is available or timeout. Returns the token or throws.
 */
export async function getTurnstileTokenForSubmit(
  options: GetTurnstileTokenOptions,
): Promise<string> {
  const {
    execute,
    getResponse,
    getRefToken,
    timeoutMs = DEFAULT_TURNSTILE_WAIT_MS,
  } = options;

  await execute();
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const refToken = getRefToken();
    if (refToken) return refToken;
    const responseToken = getResponse();
    if (responseToken) return responseToken;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Turnstile token timed out. Please try again.");
}
