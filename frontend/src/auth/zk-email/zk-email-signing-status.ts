/**
 * Store for ZK-Email signing status so the signer can report progress
 * (email sent, waiting for reply, generating proof) and modals can display it.
 */

export type ZKEmailSigningStatusPhase = "in_progress" | "success" | "error";

export interface ZKEmailSigningStatus {
  phase: ZKEmailSigningStatusPhase;
  message: string;
  detail?: string;
}

type Listener = (status: ZKEmailSigningStatus | null) => void;

let currentStatus: ZKEmailSigningStatus | null = null;
const listeners = new Set<Listener>();

/** Current signing session abort controller; UI sets on enter, aborts on modal close/cancel */
let signingAbortController: AbortController | null = null;

export function setZKEmailSigningAbortController(
  controller: AbortController | null,
): void {
  signingAbortController = controller;
}

export function getZKEmailSigningAbortController(): AbortController | null {
  return signingAbortController;
}

/** Proof-polling session (Add ZKEmail, ZKEmail Login); UI sets on enter, aborts on modal close/back */
let proofPollingAbortController: AbortController | null = null;

export function setZKEmailProofPollingAbortController(
  controller: AbortController | null,
): void {
  proofPollingAbortController = controller;
}

export function getZKEmailProofPollingAbortController(): AbortController | null {
  return proofPollingAbortController;
}

export function setZKEmailSigningStatus(
  status: ZKEmailSigningStatus | null,
): void {
  currentStatus = status;
  listeners.forEach((fn) => fn(currentStatus));
}

export function subscribeZKEmailSigningStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function getZKEmailSigningStatus(): ZKEmailSigningStatus | null {
  return currentStatus;
}

/** Provider for Turnstile token when signing (command endpoint always requires token). Set by UI when signing modal is shown. */
let turnstileTokenProvider: (() => Promise<string>) | null = null;

export function setZKEmailTurnstileTokenProvider(
  provider: (() => Promise<string>) | null,
): void {
  turnstileTokenProvider = provider;
}

export function getZKEmailTurnstileTokenProvider():
  | (() => Promise<string>)
  | null {
  return turnstileTokenProvider;
}
