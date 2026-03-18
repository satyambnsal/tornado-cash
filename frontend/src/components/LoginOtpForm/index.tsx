import React, { useEffect, useState } from "react";
import { Button } from "../ui";
import { cn } from "../../utils/classname-util";
import SpinnerV2 from "../ui/icons/SpinnerV2";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";

interface LoginOtpFormProps {
  handleOtp: (code: string) => void;
  handleResendCode: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const LoginOtpForm: React.FC<LoginOtpFormProps> = ({
  handleOtp,
  handleResendCode,
  error,
  setError,
}) => {
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (error) {
      setIsSubmitted(false);
    }
  }, [error]);

  useEffect(() => {
    if (timeLeft === 0) {
      setTimeLeft(null);
    }
    if (!timeLeft) return;
    const intervalId = setInterval(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft]);

  const isOtpValid = /^\d{6}$/.test(otp);

  async function submitOtp(e: React.UIEvent) {
    e.preventDefault();
    setIsSubmitted(true);
    try {
      await handleOtp(otp);
    } catch {
      setIsSubmitted(false);
      setError("Error Verifying OTP Code");
    }
  }

  async function submitResendCode(e: React.UIEvent) {
    e.preventDefault();
    setIsSubmitted(false);
    try {
      await handleResendCode();
      setTimeLeft(60);
    } catch {
      setError("Error Resending OTP Code");
    }
  }

  function handleOtpChange(value: string) {
    setError(null);
    setIsSubmitted(false);
    setOtp(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && isOtpValid) {
      submitOtp(e);
    }
  }

  return (
    <div
      className="ui-flex ui-flex-col ui-items-center ui-gap-6 ui-w-full"
    >
      <div
        className="ui-flex ui-justify-center ui-w-full ui-max-w-full"
        onKeyDown={handleKeyDown}
      >
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={handleOtpChange}
          disabled={isSubmitted}
          inputMode="numeric"
          autoComplete="one-time-code"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          autoFocus
        >
          <InputOTPGroup className="ui-gap-1.5 ui-justify-center sm:ui-gap-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className={cn(
                  "ui-w-12 ui-h-12 ui-shrink-0 ui-text-center ui-text-text-primary ui-text-title-lg ui-border ui-rounded-lg !ui-shadow-none",
                  "ui-outline-none ui-border-border focus-within:ui-border-border-focus ui-p-2.5 ui-bg-transparent",
                  { "ui-bg-surface-page": otp[i] },
                  {
                    "ui-border-destructive !ui-text-destructive ui-bg-inherit":
                      error,
                  },
                  { "ui-opacity-50": isSubmitted },
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <div className="ui-w-full ui-flex ui-flex-col ui-gap-2.5">
        {error && <p className="ui-text-body ui-text-center ui-text-destructive">{error}</p>}
        <Button onClick={submitOtp} disabled={!isOtpValid || isSubmitted}>
          {isSubmitted ? <SpinnerV2 size="sm" color="black" /> : "CONFIRM"}
        </Button>
        {timeLeft ? (
          <div
            className={cn(
              "ui-text-caption ui-text-secondary-text ui-w-full ui-text-center ui-py-1",
              { "ui-opacity-50": isSubmitted },
            )}
          >
            RESEND {`IN ${timeLeft}S`}
          </div>
        ) : (
          <Button
            onClick={submitResendCode}
            disabled={!!timeLeft}
            variant="text"
            size="text"
          >
            RESEND CODE {timeLeft && `in ${timeLeft} seconds`}
          </Button>
        )}
      </div>
    </div>
  );
};

export default LoginOtpForm;
