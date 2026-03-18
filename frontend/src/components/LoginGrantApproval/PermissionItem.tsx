import React, { useState, useEffect } from "react";
import { cn } from "@/utils/classname-util";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible";
import { ChevronDownIcon } from "../ui/icons";

interface PermissionItemProps {
  label: string;
  description?: string;
  expandable?: boolean;
  index?: number;
}

export function PermissionItem({
  label,
  description,
  expandable = false,
  index = 0,
}: PermissionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const delay = index * 200;
    const startTimer = setTimeout(() => setPulsing(true), delay);
    const endTimer = setTimeout(() => setPulsing(false), delay + 600);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [index]);

  if (!expandable) {
    return (
      <div
        className={cn(
          "ui-rounded-button ui-px-2.5 ui-py-2.5 ui-transition-colors ui-duration-normal",
          pulsing && "ui-bg-surface-page",
        )}
      >
        <div className="ui-flex ui-w-full ui-items-center ui-gap-2.5 ui-text-left">
          <span className="ui-mt-0.5 ui-h-1.5 ui-w-1.5 ui-flex-shrink-0 ui-rounded-full ui-bg-accent-trust" />
          <span
            className="ui-flex-1 ui-text-body ui-text-text-primary"
            style={{ overflowWrap: "anywhere" }}
          >
            {label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          "ui-rounded-button ui-px-2.5 ui-py-2.5 ui-transition-colors ui-duration-normal",
          pulsing && "ui-bg-surface-page",
          !pulsing && "hover:ui-bg-surface-page/60",
        )}
      >
        <CollapsibleTrigger className="ui-flex ui-w-full ui-items-center ui-gap-2.5 ui-text-left ui-cursor-pointer">
          <span className="ui-mt-0.5 ui-h-1.5 ui-w-1.5 ui-flex-shrink-0 ui-rounded-full ui-bg-accent-trust" />
          <span
            className="ui-flex-1 ui-text-body ui-text-text-primary"
            style={{ overflowWrap: "anywhere" }}
          >
            {label}
          </span>
          <ChevronDownIcon
            isUp={expanded}
            className="ui-h-4 ui-w-4 ui-flex-shrink-0 ui-text-text-muted"
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <p
            className="ui-pl-4 ui-pt-1 ui-text-caption ui-text-text-muted"
            style={{ overflowWrap: "anywhere" }}
          >
            {description}
          </p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
