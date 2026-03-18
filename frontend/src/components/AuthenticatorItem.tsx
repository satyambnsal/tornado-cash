import React, { useState, useMemo, memo } from "react";
import { User } from "@stytch/vanilla-js";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { EyeIcon, EyeOffIcon, TrashIcon } from "./ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import type { Authenticator } from "@burnt-labs/account-management";
import type { authenticatorTypes } from "../types";
import {
  capitalizeFirstLetter,
  getAuthenticatorLabel,
  getAuthenticatorLogo,
  extractUserIdFromAuthenticator,
  isEmailAuthenticator,
  getUserEmail,
} from "../auth/utils/authenticator-helpers";

interface AuthenticatorItemProps {
  authenticator: Authenticator;
  currentAuthenticatorIndex: number;
  isMainnet: boolean;
  onRemove: (authenticator: Authenticator, authType?: string) => void;
  user: User | null;
  authType?: string;
  authenticators: Authenticator[];
}

const AuthenticatorItemComponent: React.FC<AuthenticatorItemProps> = ({
  authenticator,
  currentAuthenticatorIndex,
  isMainnet,
  onRemove,
  user,
  authType,
  authenticators,
}) => {
  const [showEmail, setShowEmail] = useState(false);

  const isCurrentAuthenticator = useMemo(
    () => currentAuthenticatorIndex === authenticator.authenticatorIndex,
    [currentAuthenticatorIndex, authenticator.authenticatorIndex],
  );

  const userId = useMemo(
    () =>
      extractUserIdFromAuthenticator(
        authenticator.authenticator,
        authenticator.type,
      ),
    [authenticator.authenticator, authenticator.type],
  );

  const isEmailAuth = useMemo(
    () => isEmailAuthenticator(authenticator.type, authType),
    [authenticator.type, authType],
  );

  const authenticatorLabel = useMemo(
    () =>
      capitalizeFirstLetter(authType) ||
      getAuthenticatorLabel(
        authenticator.type.toUpperCase() as authenticatorTypes,
      ),
    [authType, authenticator.type],
  );

  const email = useMemo(
    () => (isEmailAuth ? getUserEmail(user, userId) : ""),
    [isEmailAuth, user, userId],
  );

  const logo = useMemo(
    () =>
      getAuthenticatorLogo(
        authenticator.type.toUpperCase() as authenticatorTypes,
        authType,
      ),
    [authenticator.type, authType],
  );

  // Logic to determine if authenticator can be removed
  const canRemove = useMemo(() => {
    // Can't remove current authenticator
    if (isCurrentAuthenticator) return false;

    // If using passkey and this is the last non-passkey, can't remove
    const currentAuth = authenticators.find(
      (a) => a.authenticatorIndex === currentAuthenticatorIndex,
    );
    const isUsingPasskey = currentAuth?.type === AUTHENTICATOR_TYPE.Passkey;
    const nonPasskeyCount = authenticators.filter(
      (a) => a.type !== AUTHENTICATOR_TYPE.Passkey,
    ).length;

    if (
      isUsingPasskey &&
      authenticator.type !== AUTHENTICATOR_TYPE.Passkey &&
      nonPasskeyCount <= 1
    ) {
      return false;
    }

    return true;
  }, [
    isCurrentAuthenticator,
    authenticators,
    currentAuthenticatorIndex,
    authenticator.type,
  ]);

  const handleToggleEmail = () => {
    setShowEmail((prev) => !prev);
  };

  const handleRemove = () => {
    onRemove(authenticator, authType);
  };

  return (
    <TooltipProvider>
      <div className="ui-flex ui-items-center ui-justify-between ui-px-4 ui-py-4 ui-min-h-16 ui-bg-surface-page ui-rounded-xl">
        <div className="ui-flex ui-flex-1 ui-items-center">
          <div className="ui-flex ui-w-8 ui-h-8 ui-bg-surface-border ui-items-center ui-justify-center ui-rounded-full">
            {logo}
          </div>
          <div className="ui-flex ui-flex-1 ui-pr-1 ui-items-start md:!ui-items-center ui-flex-col-reverse md:!ui-flex-row">
            {!(isEmailAuth && showEmail && isCurrentAuthenticator) && (
              <div className="ui-ml-4 ui-flex ui-items-center ui-justify-between">
                <p className="ui-text-body">{authenticatorLabel}</p>
              </div>
            )}
            {isEmailAuth && showEmail && isCurrentAuthenticator && email && (
              <div className="ui-ml-4 ui-flex ui-items-center ui-max-w-full ui-justify-between">
                <p className="ui-text-secondary-text ui-break-all ui-max-w-full ui-text-body">
                  {email}
                </p>
              </div>
            )}
            {isCurrentAuthenticator && (
              <div
                className={`ui-ml-2.5 ui-px-1.5 ui-py-[1px] ui-rounded-sm ui-flex ui-border ${
                  isMainnet ? "ui-border-mainnet-bg" : "ui-border-testnet-bg"
                }`}
              >
                <p
                  className={`${
                    isMainnet ? "ui-text-mainnet" : "ui-text-testnet"
                  } ui-text-caption ui-whitespace-nowrap ui-leading-[20px]`}
                >
                  Active Session
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="ui-flex ui-items-center ui-gap-4">
          {isEmailAuth && isCurrentAuthenticator && email && (
            <button
              className="ui-text-text-primary"
              onClick={handleToggleEmail}
              aria-label={showEmail ? "Hide email" : "Show email"}
            >
              {showEmail ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}
          {!isCurrentAuthenticator && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`ui-text-text-primary ${
                    !canRemove ? "ui-opacity-50 ui-cursor-not-allowed" : ""
                  }`}
                  onClick={canRemove ? handleRemove : undefined}
                  disabled={!canRemove}
                  aria-label="Remove authenticator"
                >
                  <TrashIcon className="ui-w-4 ui-h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {!canRemove
                  ? "Cannot remove: Need at least one non-passkey authenticator"
                  : "Remove authenticator"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export const AuthenticatorItem = memo(AuthenticatorItemComponent);
