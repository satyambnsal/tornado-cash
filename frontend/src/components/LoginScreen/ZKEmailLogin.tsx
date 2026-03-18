import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "../ui";
import {
  extractEmailSalt,
  generateEmailSaltFromAccountCode,
  getZKEmailStatusMessage,
  isValidZKEmailFormat,
  ZK_EMAIL_STATUS,
} from "../../auth/utils/zk-email";
import SpinnerV2 from "../ui/icons/SpinnerV2";
import {
  isValidHex,
  normalizeHexPrefix,
  validateBech32Address,
} from "@burnt-labs/signers";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { TURNSTILE_SITE_KEY } from "../../config";
import { useZKEmailVerificationFlow } from "../../hooks/useZKEmailVerificationFlow";
import { getTurnstileTokenForSubmit } from "../../utils/turnstile";

interface ZKEmailLoginProps {
  onLogin: (emailSalt: string, emailAddress: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

type LoginMode = "choose" | "direct" | "email";

export const ZKEmailLogin: React.FC<ZKEmailLoginProps> = ({
  onLogin,
  onCancel,
  onError,
}) => {
  const [loginMode, setLoginMode] = useState<LoginMode>("choose");

  // Account code login state
  const [accountCode, setAccountCode] = useState("");
  const [accountCodeEmail, setAccountCodeEmail] = useState("");
  const [isGeneratingSalt, setIsGeneratingSalt] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  // Email verification form state (email mode)
  const [email, setEmail] = useState("");
  const [xionAddress, setXionAddress] = useState("");
  const loginSuccessRef = useRef(false);

  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  const {
    phase,
    currentStatus,
    error: flowError,
    isProcessing,
    verificationResult,
    startVerification,
    reset: resetVerificationFlow,
  } = useZKEmailVerificationFlow({ onError });

  // Reset verification flow when entering email mode
  useEffect(() => {
    if (loginMode === "email") {
      resetVerificationFlow();
    }
  }, [loginMode, resetVerificationFlow]);

  // On verification success, call onLogin once
  useEffect(() => {
    if (
      loginMode !== "email" ||
      phase !== "success" ||
      !verificationResult?.proof ||
      loginSuccessRef.current
    ) {
      return;
    }
    loginSuccessRef.current = true;
    try {
      const emailSalt = extractEmailSalt(verificationResult.proof.publicInputs);
      onLogin(emailSalt, email);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get account code";
      onError(message);
    }
  }, [loginMode, phase, verificationResult, email, onLogin, onError]);

  const handleAccountCodeLogin = async () => {
    setDirectError(null);

    if (!accountCode) {
      setDirectError("Please enter your account code");
      return;
    }
    if (!accountCodeEmail) {
      setDirectError("Please enter your email address");
      return;
    }
    if (!isValidZKEmailFormat(accountCodeEmail)) {
      setDirectError("Please enter a valid email address");
      return;
    }
    const normalizedCode = normalizeHexPrefix(accountCode.trim());
    if (!isValidHex(normalizedCode)) {
      setDirectError("Account code must be a valid hexadecimal string");
      return;
    }

    setIsGeneratingSalt(true);
    try {
      const emailSalt = await generateEmailSaltFromAccountCode(
        accountCode,
        accountCodeEmail,
      );
      onLogin(emailSalt, accountCodeEmail);
    } catch (err) {
      console.error("[ZKEmailLogin] Failed to generate email salt:", err);
      setDirectError(
        err instanceof Error ? err.message : "Failed to generate email salt",
      );
    } finally {
      setIsGeneratingSalt(false);
    }
  };

  const handleEmailSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onError("");

    if (!email) {
      onError("Please enter an email address");
      return;
    }
    if (!isValidZKEmailFormat(email)) {
      onError("Please enter a valid email address");
      return;
    }
    if (!xionAddress) {
      onError("Please enter your XION address");
      return;
    }
    try {
      validateBech32Address(xionAddress, "XION address", "xion");
    } catch {
      onError("Please enter a valid XION address (e.g., xion1...)");
      return;
    }

    startVerification({
      email,
      command: xionAddress,
      xionAddress,
      getTurnstileToken: () =>
        getTurnstileTokenForSubmit({
          execute: () => turnstileRef.current?.execute?.() ?? Promise.resolve(),
          getResponse: () => turnstileRef.current?.getResponse?.() ?? "",
          getRefToken: () => turnstileTokenRef.current,
        }),
    });
  };

  const handleBack = () => {
    resetVerificationFlow();
    setLoginMode("choose");
    setDirectError(null);
    setAccountCode("");
    setAccountCodeEmail("");
  };

  const handleRetry = () => {
    resetVerificationFlow();
  };

  if (loginMode === "choose") {
    return (
      <div className="ui-flex ui-flex-col ui-gap-6 ui-items-center">
        <DialogHeader>
          <DialogTitle>Login with zk-Email</DialogTitle>
          <DialogDescription>
            Choose how you want to login with your zk-Email authenticator.
          </DialogDescription>
        </DialogHeader>
        <div className="ui-flex ui-flex-col ui-gap-4 ui-w-full">
          <button
            onClick={() => setLoginMode("direct")}
            className="ui-w-full ui-p-4 ui-bg-surface-page ui-border ui-border-surface-border ui-rounded-lg ui-text-left hover:ui-bg-surface-border ui-transition-colors"
          >
            <div className="ui-flex ui-items-start ui-gap-2.5">
              <div className="ui-w-8 ui-h-8 ui-rounded-full ui-bg-accent-trust/20 ui-flex ui-items-center ui-justify-center ui-flex-shrink-0">
                <span className="ui-text-accent-trust ui-text-body">✓</span>
              </div>
              <div>
                <p className="ui-text-label ui-text-text-primary">
                  I know my Account Code
                </p>
                <p className="ui-text-caption ui-text-text-muted ui-mt-1">
                  Enter your account code and email address to login instantly.
                </p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setLoginMode("email")}
            className="ui-w-full ui-p-4 ui-bg-surface-page ui-border ui-border-surface-border ui-rounded-lg ui-text-left hover:ui-bg-surface-border ui-transition-colors"
          >
            <div className="ui-flex ui-items-start ui-gap-2.5">
              <div className="ui-w-8 ui-h-8 ui-rounded-full ui-bg-cta/20 ui-flex ui-items-center ui-justify-center ui-flex-shrink-0">
                <span className="ui-text-cta ui-text-body">✉</span>
              </div>
              <div>
                <p className="ui-text-label ui-text-text-primary">
                  Get my Account Code via Email
                </p>
                <p className="ui-text-caption ui-text-text-muted ui-mt-1">
                  Send a verification email to retrieve your account code.
                </p>
              </div>
            </div>
          </button>
        </div>
        <Button
          variant="secondary"
          onClick={onCancel}
          className="ui-w-full"
        >
          CANCEL
        </Button>
        <div className="ui-text-center ui-text-caption ui-text-secondary-text">
          <p>
            Your account code is a unique identifier used together with your
            email to access your account securely using zero-knowledge proofs.
          </p>
        </div>
      </div>
    );
  }

  if (loginMode === "direct") {
    return (
      <div className="ui-flex ui-flex-col ui-gap-6 ui-items-center">
        <DialogHeader>
          <DialogTitle>Enter Account Code</DialogTitle>
          <DialogDescription>
            Your account code can be found in the email from{" "}
            <span className="ui-text-text-primary ui-font-medium">
              zkauth@burnt.com
            </span>{" "}
            sent when adding zk-Email authenticator. Look for the value after{" "}
            <span className="ui-text-text-primary ui-font-medium">Code</span> in the
            email.
          </DialogDescription>
        </DialogHeader>
        <div className="ui-flex ui-flex-col ui-gap-4 ui-w-full">
          <Input
            type="text"
            placeholder="Account Code (e.g., 0e608b73f96aec...)"
            value={accountCode}
            onChange={(e) => {
              setAccountCode(e.target.value);
              setDirectError(null);
            }}
            className="ui-w-full"
          />
          <Input
            type="email"
            placeholder="Email Address"
            value={accountCodeEmail}
            onChange={(e) => {
              setAccountCodeEmail(e.target.value);
              setDirectError(null);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && !isGeneratingSalt) {
                await handleAccountCodeLogin();
              }
            }}
            className="ui-w-full"
          />
          {directError && (
            <div className="ui-p-2.5 ui-bg-destructive/10 ui-border ui-border-destructive/50 ui-rounded-lg">
              <p className="ui-text-body ui-text-destructive">{directError}</p>
            </div>
          )}
        </div>
        <div className="ui-flex ui-gap-2.5 ui-w-full">
          <Button
            variant="secondary"
            onClick={handleBack}
            className="ui-flex-1"
            disabled={isGeneratingSalt}
          >
            BACK
          </Button>
          <Button
            onClick={handleAccountCodeLogin}
            disabled={isGeneratingSalt}
            className="ui-flex-1"
          >
            {isGeneratingSalt ? (
              <>
                <SpinnerV2 size="sm" color="black" />
                <span className="ui-ml-1.5">LOGGING IN...</span>
              </>
            ) : (
              "LOGIN"
            )}
          </Button>
        </div>
        <div className="ui-text-center ui-text-caption ui-text-secondary-text">
          <p>
            Don&apos;t know your account code?{" "}
            <button
              onClick={() => setLoginMode("email")}
              className="ui-text-cta ui-underline hover:ui-text-cta/80"
            >
              Get it via email verification
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Email verification mode
  const displayError = flowError ?? null;
  return (
    <div className="ui-flex ui-flex-col ui-gap-6 ui-items-center">
      <DialogHeader>
        <DialogTitle>
          {phase === "form"
            ? "Verify Email to Get Account Code"
            : phase === "success"
              ? "Email Verified!"
              : phase === "error"
                ? "Verification Failed"
                : "Verifying Email"}
        </DialogTitle>
        <DialogDescription>
          {phase === "form"
            ? "Enter your email and XION address. We'll send a verification email to retrieve your account code."
            : phase === "waiting"
              ? `Verification email sent to ${email}.`
              : phase === "polling"
                ? currentStatus
                  ? getZKEmailStatusMessage(currentStatus)
                  : "Processing verification..."
                : phase === "success"
                  ? "Email verified! Logging you in..."
                  : "Something went wrong. Please try again."}
        </DialogDescription>
      </DialogHeader>

      {phase === "form" && (
        <div className="ui-flex ui-flex-col ui-gap-4 ui-w-full">
          <Input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ui-w-full"
          />
          <Input
            type="text"
            placeholder="Enter your XION address (xion1...)"
            value={xionAddress}
            onChange={(e) => setXionAddress(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter")
                handleEmailSubmit(
                  e as unknown as React.FormEvent<HTMLInputElement>,
                );
            }}
            className="ui-w-full"
          />
          {displayError && (
            <div className="ui-p-2.5 ui-bg-destructive/10 ui-border ui-border-destructive/50 ui-rounded-lg">
              <p className="ui-text-body ui-text-destructive">{displayError}</p>
            </div>
          )}
        </div>
      )}

      {phase === "waiting" && (
        <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center">
          <div className="ui-p-4 ui-bg-status-info-subtle ui-border ui-border-status-info-border ui-rounded-lg ui-w-full">
            <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
              <div className="ui-w-2 ui-h-2 ui-bg-cta ui-rounded-full ui-animate-pulse"></div>
              <p className="ui-text-label ui-text-cta">
                Verification email sent!
              </p>
            </div>
            <p className="ui-text-caption ui-text-cta">
              Please check your email and reply &quot;confirm&quot; to the
              verification email to continue. Your account code will be
              extracted from the proof.
            </p>
          </div>
        </div>
      )}

      {phase === "polling" && (
        <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center">
          <div className="ui-p-4 ui-bg-status-warning-subtle ui-border ui-border-status-warning-border ui-rounded-lg ui-w-full">
            <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
              <SpinnerV2 size="sm" color="black" />
              <p className="ui-text-label ui-text-status-warning">
                {currentStatus === ZK_EMAIL_STATUS.email_sent_awaiting_reply
                  ? "Waiting for email reply..."
                  : currentStatus === ZK_EMAIL_STATUS.email_replied
                    ? "Generating zk-Proof..."
                    : "Processing verification..."}
              </p>
            </div>
            <p className="ui-text-caption ui-text-status-warning">
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
          <div className="ui-p-4 ui-bg-status-success-subtle ui-border ui-border-status-success-border ui-rounded-lg ui-w-full">
            <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
              <div className="ui-w-2 ui-h-2 ui-bg-accent-trust ui-rounded-full"></div>
              <p className="ui-text-label ui-text-accent-trust">
                Email verified successfully!
              </p>
            </div>
            <p className="ui-text-caption ui-text-accent-trust">
              Your account code has been retrieved. Logging you in...
            </p>
          </div>
          <SpinnerV2 size="md" color="black" />
        </div>
      )}

      {phase === "error" && displayError && (
        <div className="ui-p-2.5 ui-bg-destructive/10 ui-border ui-border-destructive/50 ui-rounded-lg ui-w-full">
          <p className="ui-text-body ui-text-destructive">{displayError}</p>
        </div>
      )}

      <div className="ui-flex ui-gap-2.5 ui-w-full">
        {phase === "error" ? (
          <>
            <Button
              variant="secondary"
              onClick={handleBack}
              className="ui-flex-1"
            >
              BACK
            </Button>
            <Button className="ui-flex-1" onClick={handleRetry}>
              TRY AGAIN
            </Button>
          </>
        ) : phase === "success" ? null : (
          <>
            <Button
              variant="secondary"
              onClick={handleBack}
              className="ui-flex-1"
              disabled={isProcessing}
            >
              BACK
            </Button>
            {phase === "form" && (
              <Button
                className="ui-flex-1"
                onClick={() => handleEmailSubmit()}
              >
                SEND EMAIL
              </Button>
            )}
          </>
        )}
      </div>

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={TURNSTILE_SITE_KEY}
          options={{
            size: "invisible",
            execution: "execute",
          }}
          onSuccess={(token) => {
            turnstileTokenRef.current = token;
          }}
          onError={() => {
            turnstileTokenRef.current = null;
          }}
          onExpire={() => {
            turnstileTokenRef.current = null;
          }}
        />
      )}

      {phase === "form" && (
        <div className="ui-text-center ui-text-caption ui-text-secondary-text">
          <p>
            Already know your account code?{" "}
            <button
              onClick={() => setLoginMode("direct")}
              className="ui-text-cta ui-underline hover:ui-text-cta/80"
            >
              Enter it directly
            </button>
          </p>
        </div>
      )}
    </div>
  );
};
