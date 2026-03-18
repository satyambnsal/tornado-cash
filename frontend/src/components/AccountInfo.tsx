import { useContext, useState, useEffect } from "react";
import { Button, CloseIcon } from "./ui";
import { useStytchUser } from "@stytch/react";
import RemoveAuthenticatorModal from "./ModalViews/RemoveAuthenticator/RemoveAuthenticatorModal";
import AddAuthenticatorsModal from "./ModalViews/AddAuthenticators/AddAuthenticatorsModal";
import type { Authenticator } from "@burnt-labs/account-management";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { AuthContext } from "./AuthContext";
import { cn } from "../utils/classname-util";
import { AuthenticatorsList } from "./AuthenticatorsList";
import { extractUserIdFromAuthenticator } from "../auth/utils/authenticator-helpers";

export const AccountInfo = () => {
  const [, setIsAddModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [authenticatorToRemove, setAuthenticatorToRemove] = useState<
    { authenticator: Authenticator; authType?: string } | undefined
  >();
  const { isMainnet, abstractAccount, setAbstractAccount } =
    useContext(AuthContext);
  const { user } = useStytchUser();

  // This effect is meant to handle the situation where the stytch session
  // changes after adding a new JWT authenticator.
  useEffect(() => {
    if (user && abstractAccount) {
      const activeJwtAuthenticator = abstractAccount.authenticators.find(
        (authenticator) =>
          authenticator.type === AUTHENTICATOR_TYPE.JWT &&
          user.user_id ===
            extractUserIdFromAuthenticator(
              authenticator.authenticator,
              authenticator.type,
            ),
      );
      if (
        activeJwtAuthenticator &&
        abstractAccount.currentAuthenticatorIndex !==
          activeJwtAuthenticator.authenticatorIndex
      ) {
        setAbstractAccount({
          ...abstractAccount,
          currentAuthenticatorIndex: activeJwtAuthenticator.authenticatorIndex,
        });
      }
    }
  }, [user, abstractAccount, setAbstractAccount]);

  const handleRemoveAuthenticator = (
    authenticator: Authenticator,
    authType?: string,
  ) => {
    setAuthenticatorToRemove({ authenticator, authType });
    setIsRemoveModalOpen(true);
  };

  return (
    <div className="ui-bg-surface-page ui-p-6 ui-rounded-xl">
      <div className="ui-flex ui-flex-col ui-gap-10">
        <div className="ui-flex">
          <div className="ui-flex ui-flex-1 ui-flex-col ui-gap-4">
            <div className="ui-flex ui-items-center ui-justify-between">
              <h3 className="ui-leading-[24px] ui-text-body-lg md:ui-text-title">
                Your Authenticators
              </h3>
              <AddAuthenticatorsModal
                trigger={
                  <Button
                    size="small"
                    onClick={() => setIsAddModalOpen(true)}
                    className={cn(
                      "ui-h-fit ui-w-fit ui-min-w-fit ui-gap-1 ui-font-bold ui-bg-transparent ui-rounded-lg ui-border ui-border-border ui-text-text-secondary",
                      "hover:ui-text-text-primary hover:ui-bg-surface-page ui-transition-all ui-duration-300",
                      "ui-px-1.5 ui-py-1 ui-text-caption md:ui-px-2.5 md:ui-py-1.5 md:ui-text-body",
                    )}
                  >
                    <CloseIcon
                      strokeWidth={3}
                      className="ui-w-2.5 ui-h-2.5 md:ui-w-3 md:ui-h-3 ui-rotate-45"
                    />
                    Add more
                  </Button>
                }
              />
            </div>
            <div className="ui-flex ui-flex-col ui-gap-4">
              {abstractAccount && (
                <AuthenticatorsList
                  authenticators={abstractAccount.authenticators}
                  currentAuthenticatorIndex={
                    abstractAccount.currentAuthenticatorIndex
                  }
                  isMainnet={isMainnet}
                  onRemoveAuthenticator={handleRemoveAuthenticator}
                  user={user}
                />
              )}
            </div>
          </div>
          {/* TODO: Add history components */}
          {/* <div className="flex flex-1 flex-col"></div> */}
        </div>
      </div>

      <RemoveAuthenticatorModal
        isOpen={isRemoveModalOpen}
        setIsOpen={setIsRemoveModalOpen}
        authenticator={authenticatorToRemove}
      />
    </div>
  );
};
