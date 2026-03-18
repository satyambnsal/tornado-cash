import { useEffect, useState } from "react";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "../../ui";
import { useStytch } from "@stytch/react";
import LoginOtpForm from "../../LoginOtpForm";
import { Loading } from "../../Loading";

export function AddEmail({
  onSubmit,
  error,
  onError,
  onClose,
}: {
  onSubmit: (otp: string, methodId: string) => void;
  error: string | null;
  onError: (error: string | null) => void;
  onClose?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [methodId, setMethodId] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savedEmail, setSavedEmail] = useState("");
  const stytch = useStytch();

  useEffect(() => {
    if (error && !isCodeSent) {
      setIsCodeSent(true);
    }
  }, [error, isCodeSent]);

  const handleEmail = async () => {
    try {
      const { method_id } = await stytch.otps.email.loginOrCreate(email, {
        login_template_id: "xion_otp",
        signup_template_id: "xion_otp_signup",
        expiration_minutes: 2,
      });
      setMethodId(method_id);
      setSavedEmail(email); // Save the email for display
      setIsCodeSent(true);
    } catch {
      onError("Error sending verification code");
    }
  };

  const handleSubmit = async (otp: string) => {
    setIsLoading(true);
    await onSubmit(otp, methodId);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <Loading
        header="Adding Authenticator"
        message="We are adding an authenticator to your account. Don't leave the page or close the window. This will take a few seconds..."
      />
    );
  }

  return (
    <div className="ui-flex ui-flex-col ui-gap-10 ui-items-center">
      <DialogHeader>
        <DialogTitle>
          {error && error.includes("already added")
            ? "Duplicate Authenticator"
            : "Add Authenticator"}
        </DialogTitle>
        <DialogDescription>
          {error && error.includes("already added")
            ? "This email is already set up as an authenticator."
            : isCodeSent
              ? `Input the 6 digit verification code. Please check your email for the verification code. You will be logged in with this account.`
              : `Enter your email to receive a verification code. Input the email
          address that you want to use as an authenticator.`}
        </DialogDescription>
      </DialogHeader>
      {!isCodeSent ? (
        <>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ui-w-full"
          />
          <Button
            className="ui-w-full"
            onClick={handleEmail}
            disabled={!email}
          >
            SEND VERIFICATION CODE
          </Button>
        </>
      ) : error && error.includes("already added") ? (
        // Show dedicated error screen for duplicate email
        <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full ui-items-center">
          <div className="ui-flex ui-flex-col ui-gap-1.5 ui-text-center">
            <p className="ui-text-destructive ui-font-semibold">
              Email Already Added
            </p>
            <p className="ui-text-secondary-text ui-text-body">
              The email <span className="ui-font-semibold">{savedEmail}</span>{" "}
              is already linked as an authenticator for this account.
            </p>
          </div>
          <Button onClick={onClose || (() => {})} className="ui-w-full">
            CLOSE
          </Button>
        </div>
      ) : (
        // Show OTP form for normal flow
        <LoginOtpForm
          handleOtp={handleSubmit}
          handleResendCode={handleEmail}
          error={error}
          setError={onError}
        />
      )}
    </div>
  );
}
