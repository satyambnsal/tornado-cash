"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "../../utils/classname-util";

// Define types for components that may have displayName
interface ComponentWithDisplayName {
  displayName?: string;
}

// Type for ref handling
type ChildrenWithRef = {
  ref?: React.Ref<HTMLElement>;
  props?: {
    onClick?: (e: React.MouseEvent) => void;
  };
};

// Type for element props with common properties
interface ElementProps {
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  to?: string;
  target?: string;
}

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "ui-z-[100] ui-max-w-[200px] ui-overflow-hidden ui-break-all ui-rounded-md ui-bg-primary ui-px-3 ui-py-1.5 ui-text-sm ui-text-primary-foreground ui-animate-in ui-fade-in-0 ui-zoom-in-95 data-[state=closed]:ui-animate-out data-[state=closed]:ui-fade-out-0 data-[state=closed]:ui-zoom-out-95 data-[side=bottom]:ui-slide-in-from-top-2 data-[side=left]:ui-slide-in-from-right-2 data-[side=right]:ui-slide-in-from-left-2 data-[side=top]:ui-slide-in-from-bottom-2 ui-origin-[--radix-tooltip-content-transform-origin]",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const InteractiveTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "ui-z-[100] ui-max-w-[300px] ui-overflow-hidden ui-rounded-md ui-bg-primary ui-px-3 ui-py-1.5 ui-text-sm ui-text-primary-foreground ui-animate-in ui-fade-in-0 ui-zoom-in-95 data-[state=closed]:ui-animate-out data-[state=closed]:ui-fade-out-0 data-[state=closed]:ui-zoom-out-95 data-[side=bottom]:ui-slide-in-from-top-2 data-[side=left]:ui-slide-in-from-right-2 data-[side=right]:ui-slide-in-from-left-2 data-[side=top]:ui-slide-in-from-bottom-2 ui-origin-[--radix-tooltip-content-transform-origin] ui-pointer-events-auto",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
      }}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
InteractiveTooltipContent.displayName = "InteractiveTooltipContent";

interface InteractiveTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  contentClassName?: string;
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
}

const InteractiveTooltip = ({
  children,
  content,
  className,
  contentClassName,
  sideOffset = 4,
  side,
  align,
  defaultOpen = false,
}: InteractiveTooltipProps) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isUserInteracting, setIsUserInteracting] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLElement | null>(null);

  const processedContent = React.useMemo(() => {
    const processNode = (node: React.ReactNode): React.ReactNode => {
      if (!React.isValidElement(node)) {
        return node;
      }

      const element = node as React.ReactElement<ElementProps>;

      // Check if component has a displayName
      const componentType = element.type as React.ComponentType &
        ComponentWithDisplayName;
      const displayName =
        typeof componentType !== "string"
          ? componentType.displayName
          : undefined;

      // Special handling for link-like elements that might navigate
      const isLinkLike =
        element.type === "a" ||
        element.type === "button" ||
        (typeof element.type === "string" &&
          element.type.toLowerCase() === "a") ||
        (element.props && element.props.href) ||
        (element.props && element.props.to) ||
        displayName === "Link";

      const newChildren = React.Children.map(
        element.props.children,
        processNode,
      );

      // For link-like elements, add special handling to prevent tooltip closing on click
      if (isLinkLike) {
        return React.cloneElement(element, {
          ...element.props,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();

            if (element.props.onClick) {
              element.props.onClick(e);
            }

            if (isMobile) {
              e.preventDefault();

              setIsUserInteracting(true);

              const linkTo = element.props.to;
              const linkHref = element.props.href;
              const targetBlank = element.props.target === "_blank";
              const isReactRouterLink = displayName === "Link" && linkTo;

              if (isReactRouterLink) {
                setTimeout(() => {
                  if (targetBlank) {
                    window.open(linkTo, "_blank");
                  } else {
                    window.location.href = linkTo;
                  }
                }, 50);
              } else if (linkHref) {
                setTimeout(() => {
                  if (targetBlank) {
                    window.open(linkHref, "_blank");
                  } else {
                    window.location.href = linkHref;
                  }
                }, 50);
              }
            }
          },
          children: newChildren,
        });
      }

      return React.cloneElement(element, {
        ...element.props,
        children: newChildren,
      });
    };

    return processNode(content);
  }, [content, isMobile]);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.matchMedia("(max-width: 768px)").matches ||
          "ontouchstart" in window ||
          navigator.maxTouchPoints > 0,
      );
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setIsUserInteracting(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!isMobile || !open) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        isUserInteracting ||
        !triggerRef.current ||
        triggerRef.current.contains(e.target as Node) ||
        (e.target as Element).closest('[role="tooltip"]')
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMobile, open, isUserInteracting]);

  const triggerElement = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<Record<string, unknown>>,
        {
          ref: (node: HTMLElement | null) => {
            triggerRef.current = node;
            // Handle ref properly with type checking
            const childWithRef = children as unknown as ChildrenWithRef;
            const originalRef = childWithRef.ref;

            if (typeof originalRef === "function") {
              originalRef(node);
            } else if (originalRef) {
              (
                originalRef as React.MutableRefObject<HTMLElement | null>
              ).current = node;
            }
          },
          onClick: (e: React.MouseEvent) => {
            const childWithProps = children as {
              props?: { onClick?: (e: React.MouseEvent) => void };
            };
            if (childWithProps.props?.onClick) {
              childWithProps.props.onClick(e);
            }

            if (isMobile) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(!open);
            }
          },
        },
      )
    : children;

  return (
    <TooltipProvider>
      <Tooltip
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && isUserInteracting && isMobile) {
            return;
          }
          setOpen(newOpen);
        }}
      >
        <TooltipTrigger asChild className={className}>
          {triggerElement}
        </TooltipTrigger>
        <InteractiveTooltipContent
          ref={(node) => {
            contentRef.current = node;

            if (node && isMobile) {
              const handleTouchStart = () => {
                setIsUserInteracting(true);
              };

              node.addEventListener("touchstart", handleTouchStart);

              return () => {
                node.removeEventListener("touchstart", handleTouchStart);
              };
            }
          }}
          sideOffset={sideOffset}
          side={side}
          align={align}
          className={contentClassName}
        >
          {processedContent}
        </InteractiveTooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  InteractiveTooltip,
  InteractiveTooltipContent,
};
