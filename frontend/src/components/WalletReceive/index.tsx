import React, { ReactElement, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui";
import { CopyAddress } from "../CopyAddress";

export function WalletReceive({
  trigger,
  xionAddress,
}: {
  trigger: ReactElement;
  xionAddress: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="ui-text-text-primary"
        onPointerDownOutside={(e) => e.preventDefault()}
        closeButton
      >
        <div className="ui-animate-scale-in">
          <DialogHeader>
            <DialogTitle>Receive XION</DialogTitle>
            <DialogDescription>
              Copy the XION address below to receive.
            </DialogDescription>
          </DialogHeader>
          <div className="ui-flex ui-flex-col ui-gap-10">
            <div className="ui-flex ui-flex-col ui-gap-6">
              <CopyAddress
                xionAddress={xionAddress}
                className="ui-w-full ui-h-14 ui-text-label ui-leading-none ui-rounded-lg ui-justify-between ui-items-center ui-bg-surface-page ui-px-4 ui-py-2"
                iconHeight={14}
                iconWidth={12}
              />
            </div>
            <Button
              className="ui-w-full ui-mt-1.5"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
