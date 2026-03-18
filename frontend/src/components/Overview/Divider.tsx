import React from "react";
import { cn } from "../../utils/classname-util";

export const Divider = ({
  margin = 6,
  className,
}: {
  margin?: number;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        `ui-my-${margin} ui-h-[1px] ui-w-full ui-bg-border`,
        className,
      )}
    />
  );
};
