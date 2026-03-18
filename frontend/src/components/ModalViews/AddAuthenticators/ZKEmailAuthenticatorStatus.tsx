import React from "react";
import SpinnerV2 from "../../ui/icons/SpinnerV2";
import type { ZKEmailSigningStatusPhase } from "../../../auth/zk-email/zk-email-signing-status";

export interface ZKEmailAuthenticatorStatusProps {
  phase: ZKEmailSigningStatusPhase;
  message: string;
  detail?: string;
  /** Optional class for the wrapper */
  className?: string;
}

/**
 * Reusable status strip for authenticator flows (zk-email signing, add auth, etc.).
 * Renders in_progress (spinner), success (check), or error styling.
 */
export function ZKEmailAuthenticatorStatus({
  phase,
  message,
  detail,
  className = "",
}: ZKEmailAuthenticatorStatusProps) {
  if (phase === "in_progress") {
    return (
      <div
        className={`ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="ui-p-4 ui-bg-yellow-900/20 ui-border ui-border-yellow-500/50 ui-rounded-lg ui-w-full">
          <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
            <SpinnerV2 size="sm" color="black" />
            <p className="ui-text-label ui-text-yellow-400">
              {message}
            </p>
          </div>
          {detail && <p className="ui-text-caption ui-text-yellow-300">{detail}</p>}
        </div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div
        className={`ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="ui-p-4 ui-bg-green-900/20 ui-border ui-border-green-500/50 ui-rounded-lg ui-w-full">
          <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
            <div className="ui-w-2 ui-h-2 ui-bg-green-500 ui-rounded-full" />
            <p className="ui-text-label ui-text-green-400">
              {message}
            </p>
          </div>
          {detail && <p className="ui-text-caption ui-text-green-300">{detail}</p>}
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        className={`ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center ${className}`}
        role="alert"
      >
        <div className="ui-p-4 ui-bg-red-900/20 ui-border ui-border-red-500/50 ui-rounded-lg ui-w-full">
          <div className="ui-flex ui-items-center ui-gap-1.5 ui-mb-1.5">
            <p className="ui-text-label ui-text-red-400">
              {message}
            </p>
          </div>
          {detail && <p className="ui-text-caption ui-text-red-300">{detail}</p>}
        </div>
      </div>
    );
  }

  return null;
}
