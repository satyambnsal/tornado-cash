import React, { useEffect, useRef } from "react";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "../../ui";
import {
  getZKEmailStatusMessage,
  ZK_EMAIL_STATUS,
  encodeBase64Url,
  proofResponseToBase64Signature,
} from "../../../auth/utils/zk-email";
import { TURNSTILE_SITE_KEY } from "../../../config";
import SpinnerV2 from "../../ui/icons/SpinnerV2";
import { useZKEmailVerificationFlow } from "../../../hooks/useZKEmailVerificationFlow";
import { getTurnstileTokenForSubmit } from "../../../utils/turnstile";

interface SelectedSmartAccount {
  id: string;
}

interface AddZKEmailProps {
  onSubmit: (signature: string, emailSalt: string) => void;
  error?: string | null;
  onError: (error: string | null) => void;
  onClose: () => void;
  abstractAccount: SelectedSmartAccount;
}

export const AddZKEmail: React.FC<AddZKEmailProps> = ({
  onSubmit,
  error: parentError,
  onError,
  onClose,
  abstractAccount,
}) => {
  const [email, setEmail] = React.useState("");
  const turnstileRef = React.useRef<TurnstileInstance | null>(null);
  const turnstileTokenRef = React.useRef<string | null>(null);
  const submittedSuccessRef = useRef(false);

  const {
    phase,
    currentStatus,
    error: flowError,
    isProcessing,
    verificationResult,
    startVerification,
  } = useZKEmailVerificationFlow({ onError });

  const displayError = parentError ?? flowError;

  // When verification succeeds, submit the authenticator once
  useEffect(() => {
    if (
      phase !== "success" ||
      !verificationResult ||
      submittedSuccessRef.current
    ) {
      return;
    }
    submittedSuccessRef.current = true;
    try {
      const { base64Signature, emailSalt } =
        proofResponseToBase64Signature(verificationResult);
      onSubmit(base64Signature, emailSalt);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to prepare signature";
      onError(message);
    }
  }, [phase, verificationResult, onSubmit, onError]);

  const handleSubmit = () => {
    onError(null);
    const command = encodeBase64Url(abstractAccount.id);
    const xionAddress = abstractAccount.id;
    startVerification({
      email,
      command,
      xionAddress,
      getTurnstileToken: () =>
        getTurnstileTokenForSubmit({
          execute: () => turnstileRef.current?.execute?.() ?? Promise.resolve(),
          getResponse: () => turnstileRef.current?.getResponse?.() ?? "",
          getRefToken: () => turnstileTokenRef.current,
        }),
    });
  };

  const pollingStatusMessage = currentStatus
    ? getZKEmailStatusMessage(currentStatus)
    : "Processing verification...";

  return (
    <div className="ui-flex ui-flex-col ui-gap-10 ui-items-center">
      <DialogHeader>
        <DialogTitle>
          {phase === "error" && displayError?.includes("already added")
            ? "Duplicate Authenticator"
            : "Add zk-Email Authenticator"}
        </DialogTitle>
        <DialogDescription>
          {phase === "error" && displayError?.includes("already added")
            ? "This email is already set up as an authenticator."
            : phase === "form"
              ? "Enter your email to receive a verification email. We'll generate a zero-knowledge proof to verify your email ownership."
              : phase === "waiting"
                ? `Verification email sent to ${email}.`
                : phase === "polling"
                  ? pollingStatusMessage
                  : phase === "success"
                    ? "zk-Email authenticator added successfully!"
                    : "Something went wrong. Please try again."}
        </DialogDescription>
      </DialogHeader>

      {phase === "form" && (
        <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full">
          <Input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ui-w-full"
          />
        </div>
      )}

      {phase === "waiting" && (
        <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center">
          <div className="ui-p-4 ui-bg-blue-900/20 ui-border ui-border-blue-500/50 ui-rounded-lg ui-w-full">
            <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
              <div className="ui-w-2 ui-h-2 ui-bg-blue-500 ui-rounded-full ui-animate-pulse"></div>
              <p className="ui-text-label ui-text-blue-400">
                Verification email sent!
              </p>
            </div>
            <p className="ui-text-caption ui-text-blue-300">
              Please check your email and reply &quot;confirm&quot; to the
              verification email to continue. The zk-proof will be generated
              automatically.
            </p>
          </div>
        </div>
      )}

      {phase === "polling" && (
        <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center">
          <div className="ui-p-4 ui-bg-yellow-900/20 ui-border ui-border-yellow-500/50 ui-rounded-lg ui-w-full">
            <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
              <SpinnerV2 size="sm" color="black" />
              <p className="ui-text-label ui-text-yellow-400">
                {currentStatus === ZK_EMAIL_STATUS.email_sent_awaiting_reply
                  ? "Waiting for email reply..."
                  : currentStatus === ZK_EMAIL_STATUS.email_replied
                    ? "Generating zk-Proof..."
                    : "Processing verification..."}
              </p>
            </div>
            <p className="ui-text-caption ui-text-yellow-300">
              {currentStatus === ZK_EMAIL_STATUS.email_sent_awaiting_reply
                ? 'Please check your email and reply "confirm" to continue.'
                : currentStatus === ZK_EMAIL_STATUS.email_replied
                  ? "Email confirmed! Generating zero-knowledge proof. This may take 10-30 seconds."
                  : "This process typically takes 10-30 seconds. Please don't close this window."}
            </p>
          </div>
        </div>
      )}

      {phase === "success" && (
        <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center">
          <div className="ui-p-4 ui-bg-green-900/20 ui-border ui-border-green-500/50 ui-rounded-lg ui-w-full">
            <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
              <div className="ui-w-2 ui-h-2 ui-bg-green-500 ui-rounded-full"></div>
              <p className="ui-text-label ui-text-green-400">
                Proof generated successfully!
              </p>
            </div>
            <p className="ui-text-caption ui-text-green-300">
              Your email has been verified and the zero-knowledge proof is
              ready. The authenticator has been added to your account.
            </p>
          </div>
        </div>
      )}

      {phase === "error" &&
        displayError &&
        !displayError.includes("already added") && (
          <div className="ui-p-2.5 ui-bg-red-900/20 ui-border ui-border-red-500/50 ui-rounded-lg ui-w-full">
            <p className="ui-text-body ui-text-red-400">{displayError}</p>
          </div>
        )}

      <div className="ui-flex ui-gap-2.5 ui-w-full">
        {phase === "success" || phase === "error" ? (
          <Button
            variant="secondary"
            onClick={onClose}
            className="ui-flex-1"
          >
            CLOSE
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={onClose}
              className="ui-flex-1"
              disabled={isProcessing}
            >
              CANCEL
            </Button>
            {phase === "form" && (
              <Button
                className="ui-flex-1"
                onClick={handleSubmit}
                disabled={!email || isProcessing}
              >
                SEND VERIFICATION EMAIL
              </Button>
            )}
          </>
        )}
      </div>

      <div className="ui-text-center ui-text-caption ui-text-gray-500">
        <p>
          This process uses zero-knowledge proofs to verify your email without
          revealing any sensitive information.
        </p>
      </div>

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={TURNSTILE_SITE_KEY}
          options={{
            execution: "execute",
            size: "invisible",
          }}
          onSuccess={(token: string) => {
            turnstileTokenRef.current = token;
          }}
          onError={() => {
            onError("CAPTCHA verification failed. Please try again.");
            turnstileTokenRef.current = null;
          }}
          onExpire={() => {
            turnstileTokenRef.current = null;
          }}
        />
      )}
    </div>
  );
};
