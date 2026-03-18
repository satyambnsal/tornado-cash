import React from "react";
import { cn } from "../../../utils/classname-util";
import { Button } from "../button";

interface EllipsisButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

const EllipsisButton = React.forwardRef<HTMLButtonElement, EllipsisButtonProps>(
  ({ onClick, className, ...props }, ref) => {
    const buttonStyles = cn(
      "ui-w-7 ui-h-7 ui-rounded-full ui-border ui-border-surface-border ui-bg-transparent hover:ui-bg-surface-page !ui-p-0",
      className,
    );

    return (
      <Button
        ref={ref}
        onClick={onClick}
        className={buttonStyles}
        {...props}
      >
        <div className="ui-flex ui-flex-col ui-items-center ui-justify-center ui-gap-0.5 ui-h-full">
          <div className="ui-w-1 ui-h-1 ui-bg-text-secondary ui-rounded-full" />
          <div className="ui-w-1 ui-h-1 ui-bg-text-secondary ui-rounded-full" />
          <div className="ui-w-1 ui-h-1 ui-bg-text-secondary ui-rounded-full" />
        </div>
      </Button>
    );
  },
);

EllipsisButton.displayName = "EllipsisButton";

export { EllipsisButton, type EllipsisButtonProps };
