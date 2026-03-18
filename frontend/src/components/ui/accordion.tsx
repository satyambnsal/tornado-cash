import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "./icons/ChevronDown";
import { cn } from "@/utils/classname-util";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("ui-border-b", className)}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="ui-flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "ui-flex ui-flex-1 ui-items-center ui-justify-between ui-py-4 ui-text-sm ui-font-medium ui-transition-all [&[data-state=open]>svg]:ui-rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="ui-h-4 ui-w-4 ui-shrink-0 ui-text-secondary-text ui-transition-transform ui-duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="ui-overflow-hidden ui-text-sm data-[state=closed]:ui-animate-accordion-up data-[state=open]:ui-animate-accordion-down"
    {...props}
  >
    <div className={cn("ui-pb-4 ui-pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
