import React from "react";
import { cn } from "../../../utils/classname-util";
import { ChevronRightIcon } from "../icons/ChevronRight";

interface NavigationButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  subLabel?: React.ReactNode;
  rightArrow?: boolean;
}

const NavigationButton = React.forwardRef<
  HTMLButtonElement,
  NavigationButtonProps
>(({ className, icon, subLabel, rightArrow, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "ui-h-[52px] ui-bg-surface-page ui-text-text-primary ui-border ui-rounded-lg ui-px-4 ui-py-3 ui-text-body ui-font-bold",
        "ui-flex ui-items-center ui-justify-start ui-gap-3",
        "hover:ui-bg-surface-border ui-transition-colors ui-duration-100 ui-ease-in-out",
        { "ui-justify-between": subLabel },
        className,
      )}
    >
      <div className="ui-flex ui-items-center ui-gap-3">
        {icon && (
          <div className="ui-flex ui-items-center ui-justify-center ui-w-6 ui-h-6 ui-min-w-6 ui-min-h-6">
            {icon}
          </div>
        )}
        {props.children}
      </div>

      <div className="ui-flex ui-items-center ui-gap-3">
        {subLabel && subLabel}
        {rightArrow && <ChevronRightIcon color="currentColor" />}
      </div>
    </button>
  );
});
NavigationButton.displayName = "NavigationButton";

export { NavigationButton, type NavigationButtonProps };
