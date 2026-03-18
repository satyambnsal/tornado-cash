import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/classname-util";

const badgeVariants = cva(
  "ui-inline-flex ui-items-center ui-rounded-md ui-border ui-px-2.5 ui-py-0.5 ui-text-xs ui-font-semibold ui-transition-colors focus:ui-outline-none focus:ui-ring-2 focus:ui-ring-ring focus:ui-ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "ui-border-transparent ui-bg-primary ui-text-white",
        secondary:
          "ui-border-transparent ui-bg-surface-page ui-text-text-primary",
        destructive:
          "ui-border-transparent ui-bg-destructive ui-text-white",
        outline: "ui-text-text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
