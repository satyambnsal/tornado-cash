import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { cn } from "@/utils/classname-util";

const InputOTP = React.forwardRef<
  React.ComponentRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "ui-flex ui-items-center ui-gap-2 has-[:disabled]:ui-opacity-50",
      containerClassName,
    )}
    className={cn("disabled:ui-cursor-not-allowed", className)}
    {...props}
  />
));
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("ui-flex ui-items-center", className)}
    {...props}
  />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        "ui-relative ui-flex ui-h-9 ui-w-9 ui-items-center ui-justify-center ui-border-y ui-border-r ui-border-border ui-text-sm ui-shadow-sm ui-transition-all first:ui-rounded-l-md first:ui-border-l last:ui-rounded-r-md",
        isActive && "ui-z-10 ui-ring-1 ui-ring-inset ui-ring-border-focus",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="ui-pointer-events-none ui-absolute ui-inset-0 ui-flex ui-items-center ui-justify-center">
          <div className="ui-h-4 ui-w-px ui-animate-caret-blink ui-bg-text-primary ui-duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <span className="ui-text-border">-</span>
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
