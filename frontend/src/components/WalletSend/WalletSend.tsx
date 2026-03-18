import React, { ReactElement, useState } from "react";
import { WalletSendForm } from "./WalletSendForm";
import { Dialog, DialogContent, DialogTrigger } from "../ui";

export function WalletSend({ trigger }: { trigger: ReactElement }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="ui-text-text-primary"
        onPointerDownOutside={(e) => e.preventDefault()}
        closeButton
      >
        <WalletSendForm setIsOpen={setIsOpen} />
      </DialogContent>
    </Dialog>
  );
}
