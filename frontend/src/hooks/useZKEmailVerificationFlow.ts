import { useCallback, useEffect, useRef, useState } from "react";
import {
  getZKEmailProofPollingAbortController,
  setZKEmailProofPollingAbortController,
} from "../auth/zk-email/zk-email-signing-status";
import {
  isValidZKEmailFormat,
  pollZKEmailStatusUntilComplete,
  toActionableZKEmailError,
  verifyEmailWithZKEmail,
  ZK_EMAIL_POLL_START_DELAY_MS,
  ZK_EMAIL_PROOF_TIMEOUT_MS,
  ZK_EMAIL_POLL_INTERVAL_MS,
  ZK_EMAIL_STATUS,
  type ZKEmailStatus,
  type ZKEmailStatusResponse,
} from "../auth/utils/zk-email";

export type ZKEmailVerificationPhase =
  | "form"
  | "waiting"
  | "polling"
  | "success"
  | "error";

export interface UseZKEmailVerificationFlowParams {
  /** Called when verification succeeds; component uses result to call onSubmit/onLogin. */
  onError?: (message: string) => void;
}

export interface StartVerificationParams {
  email: string;
  command: string;
  xionAddress: string;
  getTurnstileToken: () => Promise<string>;
}

export function useZKEmailVerificationFlow(
  params: UseZKEmailVerificationFlowParams = {},
) {
  const { onError: onErrorCallback } = params;
  const [phase, setPhase] = useState<ZKEmailVerificationPhase>("form");
  const [currentStatus, setCurrentStatus] = useState<ZKEmailStatus | null>(
    null,
  );
  const [proofId, setProofId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<ZKEmailStatusResponse | null>(null);
  const startDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setZKEmailProofPollingAbortController(controller);
    return () => {
      if (startDelayTimerRef.current) {
        clearTimeout(startDelayTimerRef.current);
        startDelayTimerRef.current = null;
      }
      controller.abort();
      setZKEmailProofPollingAbortController(null);
    };
  }, []);

  const setErrorAndNotify = useCallback(
    (message: string) => {
      const displayMessage =
        message.trim() ||
        "Failed to send verification email. Please try again.";
      setError(displayMessage);
      onErrorCallback?.(displayMessage);
    },
    [onErrorCallback],
  );

  const startVerification = useCallback(
    async (params: StartVerificationParams) => {
      const { email, command, xionAddress, getTurnstileToken } = params;
      setError(null);
      setVerificationResult(null);
      setCurrentStatus(null);
      setProofId(null);

      if (!isValidZKEmailFormat(email)) {
        const msg = "Please enter a valid email address";
        setError(msg);
        onErrorCallback?.(msg);
        return;
      }

      let token: string;
      try {
        token = await getTurnstileToken();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to verify you're human. Please try again.";
        setErrorAndNotify(msg);
        setPhase("error");
        return;
      }

      setIsProcessing(true);
      setPhase("waiting");

      try {
        const data = await verifyEmailWithZKEmail(
          email,
          command,
          xionAddress,
          token,
        );

        if (!data.success) {
          throw new Error(data.error || "Failed to send verification email");
        }
        if (!data.proofId) {
          throw new Error("No proof ID returned");
        }

        setProofId(data.proofId);
        setCurrentStatus(ZK_EMAIL_STATUS.email_sent_awaiting_reply);

        startDelayTimerRef.current = setTimeout(() => {
          startDelayTimerRef.current = null;
          const signal =
            getZKEmailProofPollingAbortController()?.signal ?? null;
          if (signal?.aborted) {
            setErrorAndNotify("Cancelled");
            setPhase("error");
            setIsProcessing(false);
            return;
          }

          setPhase("polling");

          pollZKEmailStatusUntilComplete(data.proofId!, {
            signal,
            timeoutMs: ZK_EMAIL_PROOF_TIMEOUT_MS,
            pollIntervalMs: ZK_EMAIL_POLL_INTERVAL_MS,
            onStatus: (res) => setCurrentStatus(res.status),
          })
            .then((res) => {
              setVerificationResult(res);
              setPhase("success");
            })
            .catch((err) => {
              const rawMessage =
                err instanceof Error ? err.message : String(err);
              setErrorAndNotify(toActionableZKEmailError(rawMessage));
              setPhase("error");
            })
            .finally(() => {
              setIsProcessing(false);
            });
        }, ZK_EMAIL_POLL_START_DELAY_MS);
      } catch (err) {
        const rawMessage =
          err instanceof Error
            ? err.message
            : "Failed to send verification email";
        setErrorAndNotify(toActionableZKEmailError(rawMessage));
        setPhase("error");
        setIsProcessing(false);
      }
    },
    [setErrorAndNotify, onErrorCallback],
  );

  const reset = useCallback(() => {
    if (startDelayTimerRef.current) {
      clearTimeout(startDelayTimerRef.current);
      startDelayTimerRef.current = null;
    }
    setPhase("form");
    setError(null);
    setProofId(null);
    setCurrentStatus(null);
    setVerificationResult(null);
  }, []);

  return {
    phase,
    currentStatus,
    proofId,
    error,
    isProcessing,
    verificationResult,
    startVerification,
    reset,
    setError: setErrorAndNotify,
  };
}
