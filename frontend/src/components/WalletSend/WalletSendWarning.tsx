import React from "react";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui";

interface WalletSendWarningProps {
  onContinue: () => void;
  onCancel: () => void;
}

export function WalletSendWarning({
  onContinue,
  onCancel,
}: WalletSendWarningProps) {
  return (
    <div className="ui-p-0 ui-flex ui-flex-col ui-gap-10 ui-items-center">
      <DialogHeader className="ui-flex ui-flex-col ui-gap-4 ui-w-full">
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogDescription>
          We cannot confirm the validity of this address and the transaction
          cannot be reversed.
        </DialogDescription>
      </DialogHeader>
      <div className="ui-flex ui-flex-col ui-gap-2.5 ui-w-full">
        <Button
          onClick={onContinue}
          variant="destructive"
          className="ui-w-full"
        >
          CONTINUE
        </Button>
        <Button onClick={onCancel} className="ui-w-full">
          CANCEL
        </Button>
      </div>
    </div>
  );
}
