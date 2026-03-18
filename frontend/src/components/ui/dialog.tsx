import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../utils/classname-util";
import { CloseIcon } from "./icons/Close";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

interface DialogOverlayProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Overlay
> {
  className?: string;
  overApp?: boolean;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, overApp: _overApp, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        // Base positioning
        "ui-fixed ui-inset-0 ui-z-30",
        // Animations
        "ui-transition-opacity ui-duration-200",
        "data-[state=closed]:ui-opacity-0 data-[state=open]:ui-opacity-100",
        className,
      )}
      ref={ref}
      {...props}
    >
      <div
        className={cn(
          // Positioning and dimensions
          "ui-absolute ui-inset-0 ui-w-screen ui-h-screen ui-z-30",
          // Visual styling
          "ui-bg-black/20",
        )}
      />
    </DialogPrimitive.Overlay>
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  className?: string;
  overApp?: boolean;
  closeButton?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, overApp, closeButton = false, ...props }, ref) => {
    return (
      <DialogPortal>
        <DialogOverlay overApp={overApp} />
        <DialogPrimitive.Content
          role="dialog"
          aria-modal="true"
          ref={ref}
          className={cn(
            "ui-fixed ui-z-50",
            "ui-inset-0 md:ui-m-auto md:ui-h-fit",
            "ui-w-full md:ui-min-w-[380px] md:ui-max-w-[480px]",
            "ui-flex ui-flex-col ui-justify-center ui-gap-6 ui-p-6 md:ui-p-10",
            "ui-bg-surface ui-rounded-none md:ui-rounded-card md:ui-border md:ui-border-black/10 ui-shadow-[0_4px_24px_0_rgba(0,0,0,0.08)]",
            "ui-h-screen ui-max-h-screen md:ui-max-h-[90vh]",
            "md:ui-origin-center md:ui-scale-[0.8]",
            "ui-outline-none ui-transition-opacity ui-duration-200",
            "data-[state=closed]:ui-opacity-0",
            "data-[state=open]:ui-opacity-100",
            className,
          )}
          {...props}
        >
          {closeButton && (
            <DialogClose
              className="ui-absolute ui-top-6 ui-right-6"
              aria-label="Close dialog"
            >
              <CloseIcon strokeWidth={2} className="ui-w-4 ui-h-4" />
            </DialogClose>
          )}
          <div className="ui-flex ui-flex-col ui-gap-6 ui-overflow-y-auto ui-overflow-x-hidden ui-max-h-full">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ui-flex ui-flex-col ui-text-center ui-gap-2 ui-w-full",
        className,
      )}
      {...props}
    />
  );
}
DialogHeader.displayName = "DialogHeader";

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ui-flex ui-flex-col ui-gap-3 ui-items-stretch ui-w-full",
        className,
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";

interface DialogTitleProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Title
> {
  className?: string;
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  DialogTitleProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    className={cn(
      "ui-text-title ui-tracking-tight",
      className,
    )}
    ref={ref}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

interface DialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Description
> {
  className?: string;
}

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    className={cn(
      "ui-text-secondary-text ui-text-body ui-max-w-[340px] ui-mx-auto",
      className,
    )}
    ref={ref}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
