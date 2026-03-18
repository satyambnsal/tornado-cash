import React, { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix">;

export interface ITextFieldProps extends BaseInputProps {
  className?: string;
  error?: string;
  baseInputClassName?: string;
  onKeyDown?: (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => false | Promise<void>;
}
export function Input({
  className,
  placeholder,
  // This should only be used for specific classes that can't override the base input styles.
  baseInputClassName,
  value,
  error,
  onBlur,
  onFocus,
  onKeyDown,
  id: externalId,
  ...props
}: ITextFieldProps) {
  const generatedId = useId();
  const inputId = externalId || generatedId;
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsInputFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (event.target.value === "") {
      setIsInputFocused(false);
    }
    onBlur?.(event);
  };

  return (
    <div className={`ui-relative ui-w-full ui-text-left ${className || ""}`}>
      <label
        htmlFor={inputId}
        className={`ui-relative ui-z-0 ui-w-auto ui-transition-all ui-duration-100 ui-ease-linear  ui-text-secondary-text ${
          isInputFocused || value
            ? "ui-top-0 ui-text-xs ui-leading-tight"
            : "ui-top-7"
        }`}
      >
        {placeholder}
      </label>
      <input
        {...props}
        id={inputId}
        className={`${
          baseInputClassName || ""
        } ui-z-10 ui-block ui-h-8 ui-w-full ui-border-b ui-border-border ui-rounded-none ui-relative ${
          error ? "ui-border-destructive" : ""
        } ui-bg-transparent ui-font-akkuratLL ui-py-4 !ui-text-base ui-text-text-primary ui-font-normal ui-leading-tight ui-outline-none`}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={onKeyDown}
        style={{
          WebkitBorderRadius: "none",
        }}
        value={value}
      />
      <p className="ui-left-0 -ui-bottom-4 ui-text-xs ui-h-3 ui-w-full ui-leading-tight ui-absolute ui-text-destructive">
        {error}
      </p>
    </div>
  );
}
