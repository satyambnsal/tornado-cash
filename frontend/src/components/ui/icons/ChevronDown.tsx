import React from "react";
import { cn } from "../../../utils/classname-util";

export const ChevronDownIcon = ({
  isUp = false,
  className,
}: {
  isUp?: boolean;
  className?: string;
}) => {
  return (
    <svg
      data-testid="chevron-down-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "ui-h-5 ui-w-5 ui-transform ui-text-current ui-transition-transform ui-duration-300 ui-ease-in-out",
        className,
      )}
      style={{ transform: isUp ? "rotate(180deg)" : "" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
};
