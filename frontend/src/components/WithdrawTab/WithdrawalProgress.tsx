/**
 * Withdrawal Progress Component
 * Shows progress during withdrawal process
 */

import type { WithdrawStatus } from "../../types/tornado";
import { Spinner } from "../ui/icons/Spinner";
import { CheckIcon as Check } from "../ui/icons/Check";
import { AnimatedCheckmark } from "../ui/icons/AnimatedCheck";

interface WithdrawalProgressProps {
  status: WithdrawStatus;
  error?: string | null;
  txHash?: string | null;
}

export function WithdrawalProgress({
  status,
  error,
  txHash,
}: WithdrawalProgressProps) {
  const steps: { key: WithdrawStatus; label: string; estimate?: string }[] = [
    { key: "validating", label: "Validating Note" },
    { key: "building_tree", label: "Building Merkle Proof", estimate: "~5s" },
    {
      key: "generating_proof",
      label: "Generating Zero-Knowledge Proof",
      estimate: "10-30s",
    },
    { key: "withdrawing", label: "Executing Withdrawal" },
    { key: "success", label: "Withdrawal Complete" },
  ];

  const currentStepIndex = steps.findIndex((step) => step.key === status);

  if (status === "error") {
    return (
      <div className="ui-space-y-4">
        <div className="ui-bg-error ui-text-error-foreground ui-p-6 ui-rounded-lg ui-text-center">
          <h3 className="ui-text-lg ui-font-semibold ui-mb-2">
            Withdrawal Failed
          </h3>
          <p className="ui-text-sm">{error || "An error occurred"}</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="ui-space-y-4">
        <div className="ui-bg-success ui-text-success-foreground ui-p-6 ui-rounded-lg ui-text-center">
          <div className="ui-flex ui-justify-center ui-mb-4">
            <AnimatedCheckmark className="ui-w-16 ui-h-16" />
          </div>
          <h3 className="ui-text-lg ui-font-semibold ui-mb-2">
            Withdrawal Successful!
          </h3>
          <p className="ui-text-sm">Your funds have been withdrawn</p>
          {txHash && (
            <div className="ui-mt-4 ui-pt-4 ui-border-t ui-border-success-foreground/20">
              <p className="ui-text-xs ui-mb-2">Transaction Hash:</p>
              <p className="ui-font-mono ui-text-xs ui-break-all">{txHash}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ui-space-y-4">
      <div className="ui-bg-muted ui-p-6 ui-rounded-lg">
        <h3 className="ui-text-lg ui-font-semibold ui-mb-6 ui-text-center">
          Withdrawal in Progress
        </h3>

        <div className="ui-space-y-4">
          {steps.slice(0, -1).map((step, index) => {
            const isActive = index === currentStepIndex;
            const isComplete = index < currentStepIndex;

            return (
              <div
                key={step.key}
                className={`ui-flex ui-items-center ui-gap-4 ui-p-3 ui-rounded-lg ui-transition-colors ${
                  isActive
                    ? "ui-bg-foreground ui-text-background"
                    : isComplete
                      ? "ui-bg-foreground/10"
                      : "ui-opacity-50"
                }`}
              >
                <div
                  className={`ui-flex-shrink-0 ui-w-8 ui-h-8 ui-rounded-full ui-flex ui-items-center ui-justify-center ${
                    isActive
                      ? "ui-bg-background ui-text-foreground"
                      : isComplete
                        ? "ui-bg-foreground ui-text-background"
                        : "ui-border ui-border-current"
                  }`}
                >
                  {isComplete ? (
                    <Check className="ui-w-5 ui-h-5" />
                  ) : isActive ? (
                    <Spinner className="ui-w-5 ui-h-5" />
                  ) : (
                    <span className="ui-text-sm">{index + 1}</span>
                  )}
                </div>

                <div className="ui-flex-1">
                  <p
                    className={`ui-font-medium ${isActive ? "ui-font-semibold" : ""}`}
                  >
                    {step.label}
                  </p>
                  {isActive && step.estimate && (
                    <p className="ui-text-xs ui-opacity-80 ui-mt-1">
                      Estimated time: {step.estimate}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {status === "generating_proof" && (
          <div className="ui-mt-6 ui-p-4 ui-bg-background ui-rounded-lg ui-text-center ui-text-sm ui-text-muted-foreground">
            <p>
              Generating zero-knowledge proof... This may take up to 30 seconds.
            </p>
            <p className="ui-mt-2">Please do not close this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
