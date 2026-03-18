import React from "react";
import { cn } from "../../../utils/classname-util";
import { ReceiveIcon } from "../icons/Receive";
import { SendIcon } from "../icons/Send";

interface WalletActionButtonProps {
  type: "receive" | "send";
  className?: string;
  children?: React.ReactNode;
}

const WalletActionButton = React.forwardRef<
  HTMLButtonElement,
  WalletActionButtonProps
>(({ className, type, ...props }, ref) => {
  const typeIcon = type === "receive" ? <ReceiveIcon /> : <SendIcon />;
  const typeText = type === "receive" ? "Receive" : "Send";

  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "ui-flex ui-flex-col ui-items-start ui-gap-3 ui-bg-surface-page ui-rounded-xl ui-p-3 ui-w-full ui-max-w-[150px]",
        "hover:ui-bg-surface-border ui-transition-colors ui-duration-200",
        className,
      )}
    >
      {typeIcon}
      <p className="ui-text-text-primary ui-text-sm ui-leading-4 ui-font-bold">
        {typeText}
      </p>
    </button>
  );
});
WalletActionButton.displayName = "WalletActionButton";

export { WalletActionButton, type WalletActionButtonProps };
