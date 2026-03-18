import React, { Dispatch, SetStateAction } from "react";
import { Dialog, DialogContent, DialogTrigger } from "../../ui";
import { RemoveAuthenticatorForm } from "./RemoveAuthenticatorForm";
import type { Authenticator } from "@burnt-labs/account-management";

export default function RemoveAuthenticatorModal({
  isOpen,
  setIsOpen,
  authenticator,
}: {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  authenticator?: { authenticator: Authenticator; authType?: string };
}) {
  return (
    <Dialog modal onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger className="ui-hidden"></DialogTrigger>
      <DialogContent
        onPointerDownOutside={(e: CustomEvent) => e.preventDefault()}
        closeButton
      >
        <RemoveAuthenticatorForm
          authenticator={authenticator?.authenticator}
          authType={authenticator?.authType || undefined}
          setIsOpen={setIsOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
