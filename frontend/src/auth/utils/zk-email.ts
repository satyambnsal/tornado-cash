import { ZK_EMAIL_BACKEND_URL, IS_DEV } from "../../config";
import { isValidHex, toUrlSafeBase64 } from "@burnt-labs/signers/crypto";

/** Single source of zk-email timing constants. */
export const ZK_EMAIL_POLL_INTERVAL_MS = 3000;
export const ZK_EMAIL_PROOF_TIMEOUT_MS = 5 * 60 * 1000;
/** Delay (ms) before starting to poll after verification email is sent. */
export const ZK_EMAIL_POLL_START_DELAY_MS = 2000;
/** Timeout (ms) for a single request to the ZK-Email API network calls (command, status, etc.). */ 
export const ZK_EMAIL_API_REQUEST_TIMEOUT_MS = 60 * 1000;


export interface ZKProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
}

/** Request body for ZK-Email verify (command) endpoint */
export interface ZKEmailVerifyRequest {
  email: string;
  command: string;
  xionAddress: string;
  turnstileToken: string;
}

export const STATUS_ORDER = {
  not_found: -1,
  initialised: 0,
  email_sent_awaiting_reply: 1,
  email_replied: 2,
  proof_generation_success: 3,
  proof_generation_failed: 3, // Final status
} as const;

/** Status values returned by the ZK-Email status API. Use these instead of raw strings. */
export const ZK_EMAIL_STATUS = {
  not_found: "not_found",
  initialised: "initialised",
  email_sent_awaiting_reply: "email_sent_awaiting_reply",
  email_replied: "email_replied",
  proof_generation_success: "proof_generation_success",
  proof_generation_failed: "proof_generation_failed",
} as const;

export type ZKEmailStatus = keyof typeof STATUS_ORDER;

/**
 * Basic email format validation for ZK-Email flows.
 * Matches typical email format: local@domain.tld (no spaces, single @, dot in domain).
 */
export function isValidZKEmailFormat(email: string): boolean {
  if (typeof email !== "string" || !email.trim()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/** Message strings returned by the ZK-Email status API for each status. */
export const ZK_EMAIL_STATUS_API_MESSAGES: Record<ZKEmailStatus, string> = {
  not_found: "Verification not found. Please try again.",
  initialised: "Command has been initialised and is being processed",
  email_sent_awaiting_reply: "Confirmation email sent, awaiting user reply",
  email_replied: "Received email reply, proof generation in progress",
  proof_generation_success: "Proof has been successfully generated",
  proof_generation_failed: "Proof generation failed",
};

export interface ZKEmailStatusResponse {
  proofId: string;
  status: ZKEmailStatus;
  message?: string;
  createdAt?: string;
  completedAt?: string;
  proof?: {
    proof: ZKProof;
    publicInputs: string[];
  };
}

export interface ZKEmailBackendResponse {
  success: boolean;
  proofId?: string;
  error?: string;
}

/**
 * Get the ZK-Email backend URL from config (internal use).
 * Validates that the URL exists and is a valid URL.
 */
const getZKEmailBackendUrl = (): string => {
  const url = ZK_EMAIL_BACKEND_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error(
      "ZK_EMAIL_BACKEND_URL is not set. Configure VITE_ZKEMAIL_BACKEND_URL or network zkEmailBackendUrl.",
    );
  }
  try {
    new URL(url);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `ZK_EMAIL_BACKEND_URL is not a valid URL: ${url} (${detail})`,
    );
  }
  return url.trim();
};

/**
 * Encode a string to base64url format
 * @param input - The string to encode
 * @returns Base64url encoded string
 */
export const encodeBase64Url = (input: string): string => {
  // Convert string to base64url
  return toUrlSafeBase64(btoa(input));
};

/**
 * Encode a Uint8Array directly to base64url format (uses @burnt-labs/signers/crypto).
 * @param bytes - The Uint8Array to encode
 * @returns Base64url encoded string
 */
export const encodeBase64UrlFromBytes = (bytes: Uint8Array): string => {
  const base64 = btoa(String.fromCharCode(...bytes));
  return toUrlSafeBase64(base64);
};

/**
 * Call the ZK-Email backend to send verification email and generate proof
 * @param email - User's email address
 * @param command - Command to encode (typically the xion address)
 * @param xionAddress - The xion address for the account
 * @param turnstileToken - Cloudflare Turnstile token for bot protection
 */
async function parseJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Invalid response (expected JSON): ${text.slice(0, 200)}${text.length > 200 ? "…" : ""} [${detail}]`,
    );
  }
}

export const verifyEmailWithZKEmail = async (
  email: string,
  command: string,
  xionAddress: string,
  turnstileToken: string,
): Promise<ZKEmailBackendResponse> => {
  const backendUrl = getZKEmailBackendUrl();
  const encodedCommand = command;

  const requestUrl = `${backendUrl}/command`;
  const requestBody: ZKEmailVerifyRequest = {
    email,
    command: encodedCommand,
    xionAddress,
    turnstileToken,
  };

  if (IS_DEV) {
    console.log("[ZK-Email] Sending request to:", requestUrl);
    // Note: Don't log full request body in production - contains email addresses
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZK_EMAIL_API_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (IS_DEV) console.log("[ZK-Email] Response status:", response.status);

    if (!response.ok) {
      const errorData = (await parseJsonOrText(response)) as { error?: string };
      // Log error status without sensitive data
      console.error("[ZK-Email] Request failed with status:", response.status);
      throw new Error(
        errorData && typeof errorData.error === "string"
          ? errorData.error
          : "Failed to process ZK-Email verification",
      );
    }

    const data = (await parseJsonOrText(response)) as ZKEmailBackendResponse;
    if (IS_DEV) console.log("[ZK-Email] Success response:", data);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out or was cancelled");
    }
    throw err;
  }
};

/** Index of email salt in public inputs array (0-based). */
const EMAIL_SALT_INDEX = 68;

/**
 * Extract the email salt from the public inputs
 * @param publicInputs - Array of public inputs from the circuit
 * @returns The email salt as a string
 * @throws If publicInputs is not a valid array or index is out of bounds
 */
export function extractEmailSalt(publicInputs: string[]): string {
  if (!Array.isArray(publicInputs)) {
    throw new Error("extractEmailSalt: publicInputs must be an array");
  }
  if (publicInputs.length <= EMAIL_SALT_INDEX) {
    throw new Error(
      `extractEmailSalt: publicInputs must have at least ${EMAIL_SALT_INDEX + 1} elements (got ${publicInputs.length})`,
    );
  }
  const emailSalt = publicInputs[EMAIL_SALT_INDEX];
  if (typeof emailSalt !== "string") {
    throw new Error(
      `extractEmailSalt: publicInputs[${EMAIL_SALT_INDEX}] must be a string`,
    );
  }
  return emailSalt;
}

/**
 * Get user-friendly status message for ZK-Email verification.
 * Uses API message text for consistency with the status endpoint.
 */
export const getZKEmailStatusMessage = (status: ZKEmailStatus): string => {
  return ZK_EMAIL_STATUS_API_MESSAGES[status] ?? "Processing verification...";
};

/**
 * Map backend/network errors to actionable user-facing messages.
 * Single source for all ZK-Email flows (login, add authenticator, etc.).
 */
export function toActionableZKEmailError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch")
  ) {
    return "Connection problem. Check your internet and try again.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (lower.includes("invalid email") || lower.includes("email")) {
    return "Please use a valid email address and try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Request timed out. Check your connection and try again.";
  }
  if (
    lower.includes("unavailable") ||
    lower.includes("503") ||
    lower.includes("502")
  ) {
    return "Service temporarily unavailable. Please try again in a moment.";
  }
  return rawMessage || "Failed to send verification email. Please try again.";
}

/**
 * Check if the status indicates completion (success or failure)
 */
export const isZKEmailStatusComplete = (status: ZKEmailStatus): boolean => {
  return (
    status === ZK_EMAIL_STATUS.proof_generation_success ||
    status === ZK_EMAIL_STATUS.proof_generation_failed
  );
};

/**
 * Check if the status indicates success
 */
export const isZKEmailStatusSuccess = (status: ZKEmailStatus): boolean => {
  return status === ZK_EMAIL_STATUS.proof_generation_success;
};

/**
 * Check the status of a ZK-Email verification by proof ID
 */
export const checkZKEmailStatus = async (
  proofId: string,
): Promise<ZKEmailStatusResponse> => {
  const backendUrl = getZKEmailBackendUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZK_EMAIL_API_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${backendUrl}/status/${encodeURIComponent(proofId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = (await parseJsonOrText(response)) as { error?: string };
      throw new Error(
        errorData && typeof errorData.error === "string"
          ? errorData.error
          : "Failed to check ZK-Email status",
      );
    }

    const responseData = (await parseJsonOrText(response)) as Record<
      string,
      unknown
    >;
    if (
      responseData &&
      typeof responseData.proof === "object" &&
      responseData.proof !== null &&
      "publicOutputs" in responseData.proof
    ) {
      (responseData.proof as Record<string, unknown>).publicInputs = (
        responseData.proof as Record<string, unknown>
      ).publicOutputs;
      delete (responseData.proof as Record<string, unknown>).publicOutputs;
    }
    return responseData as unknown as ZKEmailStatusResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out or was cancelled");
    }
    throw err;
  }
};

export interface PollZKEmailStatusOptions {
  signal?: AbortSignal | null;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onStatus?: (res: ZKEmailStatusResponse) => void;
}

/**
 * Single implementation of polling: request-after-response, fail session on any poll failure.
 * Schedule the next poll only after the current checkZKEmailStatus response is received,
 * then wait pollIntervalMs before the next request. If any poll request fails, reject immediately.
 * Used by signer, ZKEmailLogin (email path), and AddZKEmail.
 */
function delayOrAbort(ms: number, signal: AbortSignal | null): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("Polling cancelled"));
  }
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeoutId);
          reject(new Error("Polling cancelled"));
        },
        { once: true },
      );
    }
  });
}

export async function pollZKEmailStatusUntilComplete(
  proofId: string,
  options: PollZKEmailStatusOptions = {},
): Promise<ZKEmailStatusResponse> {
  const {
    signal = null,
    timeoutMs = ZK_EMAIL_PROOF_TIMEOUT_MS,
    pollIntervalMs = ZK_EMAIL_POLL_INTERVAL_MS,
    onStatus,
  } = options;
  const deadline = Date.now() + timeoutMs;

  const cancelIfAborted = (): boolean => {
    if (signal?.aborted) return true;
    return false;
  };

  const poll = async (): Promise<ZKEmailStatusResponse> => {
    if (cancelIfAborted()) {
      throw new Error("Polling cancelled");
    }
    if (Date.now() > deadline) {
      throw new Error("ZK-Email proof request timed out");
    }

    const statusResponse = await checkZKEmailStatus(proofId);
    if (cancelIfAborted()) {
      throw new Error("Polling cancelled");
    }

    onStatus?.(statusResponse);

    if (isZKEmailStatusComplete(statusResponse.status)) {
      if (
        isZKEmailStatusSuccess(statusResponse.status) &&
        statusResponse.proof
      ) {
        return statusResponse;
      }
      throw new Error(getZKEmailStatusMessage(statusResponse.status));
    }

    await delayOrAbort(pollIntervalMs, signal);
    return poll();
  };

  return poll();
}

/**
 * Convert a successful ZKEmailStatusResponse to base64 signature and email salt.
 * Used by AddZKEmail and any consumer that needs to submit an authenticator.
 */
export function proofResponseToBase64Signature(
  statusResponse: ZKEmailStatusResponse,
): { base64Signature: string; emailSalt: string } {
  if (!statusResponse.proof) {
    throw new Error("proofResponseToBase64Signature: proof is required");
  }
  const { proof: _proof, publicInputs } = statusResponse.proof;
  const signature = JSON.stringify(statusResponse.proof);
  const base64Signature = Buffer.from(signature, "utf-8").toString("base64");
  const emailSalt = extractEmailSalt(publicInputs);
  return { base64Signature, emailSalt };
}

/**
 * Generate email salt from account code and email address via backend API
 * @param accountCode - The account code (hex string, with or without 0x prefix)
 * @param emailAddress - The email address
 * @returns The email salt as a decimal string
 */
export const generateEmailSaltFromAccountCode = async (
  accountCode: string,
  emailAddress: string,
): Promise<string> => {
  // Validate account code is a valid hex string (using @burnt-labs/signers/crypto)
  let normalizedAccountCode = accountCode.trim();

  // Remove 0x prefix if present for validation
  if (normalizedAccountCode.startsWith("0x")) {
    normalizedAccountCode = normalizedAccountCode.slice(2);
  }

  if (!normalizedAccountCode || !isValidHex(normalizedAccountCode)) {
    throw new Error("Invalid account code: must be a hexadecimal string");
  }

  const backendUrl = getZKEmailBackendUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZK_EMAIL_API_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${backendUrl}/generate-email-salt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountCode: normalizedAccountCode,
        emailAddress: emailAddress,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = (await parseJsonOrText(response)) as { error?: string };
      throw new Error(
        errorData && typeof errorData.error === "string"
          ? errorData.error
          : "Failed to generate email salt",
      );
    }

    const data = (await parseJsonOrText(response)) as { emailSalt?: string };
    if (typeof data?.emailSalt !== "string") {
      throw new Error("Invalid response: missing emailSalt");
    }
    return data.emailSalt;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw new Error(
      `Failed to generate email salt: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};
