import React from "react";
import { cn } from "../../../utils/classname-util";

export const CloseIcon = ({
  onClick,
  className,
  strokeWidth = 2,
}: {
  onClick?: VoidFunction;
  className?: string;
  strokeWidth?: number;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("ui-h-6 ui-w-6", className)}
    onClick={onClick}
    data-testid="close-icon"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
