import React, { useContext } from "react";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui";
import { AuthContext, AuthContextProps } from "../AuthContext";
import { CONNECTION_METHOD } from "../../auth/useAuthState";
import { ErrorIcon } from "../ui/icons/Error";

export const LoginErrorDisplay = ({
  title = "OOPS! Something went wrong...",
  description = "Please try again later.",
  errorMessage,
  onClose,
  buttonText = "Close",
  onButtonClick,
}: {
  title?: string;
  description?: string;
  errorMessage?: string;
  onClose?: VoidFunction;
  buttonText?: string;
  onButtonClick?: VoidFunction;
}) => {
  const { setAbstraxionError, setConnectionMethod } = useContext(
    AuthContext,
  ) as AuthContextProps;

  const handleButtonClick = () => {
    // Reset login state so user can try a different authenticator
    localStorage.removeItem("loginType");
    localStorage.removeItem("loginAuthenticator");
    localStorage.removeItem("okxXionAddress");
    localStorage.removeItem("okxWalletName");
    setConnectionMethod(CONNECTION_METHOD.None);
    setAbstraxionError("");

    if (onButtonClick) {
      onButtonClick();
    } else {
      onClose?.();
    }
  };

  return (
    <div className="ui-flex ui-h-full ui-w-full ui-flex-col ui-items-center ui-justify-center ui-gap-6">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {errorMessage && (
        <div className="ui-w-full ui-border ui-border-destructive ui-rounded-lg ui-bg-destructive/10 ui-p-4 ui-flex ui-flex-col ui-items-center ui-text-center ui-gap-2.5">
          <ErrorIcon />
          <span className="ui-font-bold ui-text-body-lg">
            Error Message
          </span>
          <p className="ui-text-body ui-font-bold">{errorMessage}</p>
        </div>
      )}

      <Button className="ui-w-full" onClick={handleButtonClick}>
        {buttonText}
      </Button>
    </div>
  );
};
