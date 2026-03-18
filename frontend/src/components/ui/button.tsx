import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/classname-util";

const buttonVariants = cva(
  "ui-px-4 ui-py-2 ui-inline-flex ui-items-center ui-justify-center ui-gap-2 ui-whitespace-nowrap ui-rounded-button ui-text-sm ui-ring-offset-background ui-transition-colors focus-visible:ui-outline-none focus-visible:ui-ring-2 focus-visible:ui-ring-inset focus-visible:ui-ring-ring disabled:ui-opacity-50 disabled:ui-pointer-events-none",
  {
    variants: {
      variant: {
        default: "ui-bg-cta ui-text-white hover:ui-bg-cta/90",
        secondary: "ui-border ui-border-border hover:ui-bg-surface-page",
        destructive:
          "ui-bg-transparent ui-text-accent-error ui-border ui-border-accent-error hover:ui-bg-accent-error/10",
        text: "ui-text-secondary-text hover:ui-text-text-primary",
      },
      size: {
        default: "ui-h-12",
        large: "ui-h-[52px]",
        small: "ui-h-10 ui-min-w-[100px] ui-w-fit",
        text: "ui-p-1 ui-fit ui-leading-none",
        icon: "ui-h-10 ui-w-10",
        "icon-large": "ui-h-12 ui-w-12 ui-min-w-12 ui-min-h-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
