import React, { useState, useEffect, useCallback } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/classname-util";

const checkboxVariants = cva(
  "ui-w-4 ui-h-4 ui-rounded ui-border ui-flex ui-items-center ui-justify-center ui-transition-colors ui-duration-200 focus-visible:ui-outline-none focus-visible:ui-ring-2 focus-visible:ui-ring-cta focus-visible:ui-ring-offset-2 focus-visible:ui-ring-offset-white",
  {
    variants: {
      variant: {
        default: "ui-border-gray-400",
        warning: "ui-border-warning focus-visible:ui-ring-warning",
        destructive: "ui-border-destructive focus-visible:ui-ring-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const checkmarkVariants = cva(
  "ui-w-2.5 ui-h-2.5 ui-rounded-sm ui-transition-all ui-duration-200 ui-scale-100 ui-opacity-100",
  {
    variants: {
      variant: {
        default: "ui-bg-cta",
        warning: "ui-bg-warning",
        destructive: "ui-bg-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const labelVariants = cva("ui-text-sm", {
  variants: {
    variant: {
      default: "ui-text-primary",
      warning: "ui-text-warning",
      destructive: "ui-text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface CheckboxProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  checked?: boolean;
  onChange?:
    | ((e: React.ChangeEvent<HTMLInputElement>) => void)
    | ((checked: boolean) => void);
  label?: string;
  variant?: VariantProps<typeof checkboxVariants>["variant"];
  id?: string;
  disabled?: boolean;
}

export const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
  (
    {
      className,
      variant,
      label,
      checked = false,
      onChange,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [isChecked, setIsChecked] = useState(checked);

    useEffect(() => {
      setIsChecked(checked);
    }, [checked]);

    const handleToggle = useCallback(() => {
      if (disabled) return;

      const newChecked = !isChecked;
      setIsChecked(newChecked);

      if (onChange) {
        // Create a synthetic event if the handler expects one
        if (onChange.length > 0) {
          const syntheticEvent = {
            target: {
              checked: newChecked,
              type: "checkbox",
              name: id || "",
            },
          } as React.ChangeEvent<HTMLInputElement>;
          (onChange as (e: React.ChangeEvent<HTMLInputElement>) => void)(
            syntheticEvent,
          );
        } else {
          // If the handler expects a boolean
          (onChange as (checked: boolean) => void)(newChecked);
        }
      }
    }, [isChecked, onChange, disabled, id]);

    // Generate an ID if none is provided
    const checkboxId =
      id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div
        className="ui-flex ui-items-center ui-gap-2"
        role="presentation"
        ref={ref}
        {...props}
      >
        <div
          className={cn(
            checkboxVariants({ variant, className }),
            "ui-cursor-pointer",
            disabled && "ui-opacity-50 ui-cursor-not-allowed",
          )}
          role="checkbox"
          aria-checked={isChecked}
          aria-disabled={disabled}
          aria-labelledby={label ? `${checkboxId}-label` : undefined}
          tabIndex={disabled ? -1 : 0}
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggle();
            }
          }}
          id={checkboxId}
        >
          <div
            className={cn(
              checkmarkVariants({ variant }),
              "ui-transform ui-transition-all ui-duration-200",
              isChecked
                ? "ui-scale-100 ui-opacity-100"
                : "ui-scale-0 ui-opacity-0",
            )}
            aria-hidden="true"
          />
        </div>
        {label && (
          <label
            className={cn(
              labelVariants({ variant }),
              "ui-cursor-pointer",
              disabled && "ui-opacity-50 ui-cursor-not-allowed",
            )}
            id={`${checkboxId}-label`}
            htmlFor={checkboxId}
            onClick={handleToggle}
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
