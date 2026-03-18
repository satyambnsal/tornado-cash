import React from "react";
import { Skeleton } from "./ui/skeleton";

interface AuthenticatorsLoadingSkeletonProps {
  count?: number;
}

export const AuthenticatorsLoadingSkeleton: React.FC<
  AuthenticatorsLoadingSkeletonProps
> = ({ count = 3 }) => {
  return (
    <div className="ui-flex ui-flex-col ui-gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="ui-flex ui-items-center ui-justify-between ui-px-4 ui-py-4 ui-min-h-16 ui-bg-surface-page ui-rounded-xl"
        >
          <div className="ui-flex ui-flex-1 ui-items-center">
            {/* Logo skeleton */}
            <Skeleton className="ui-w-8 ui-h-8 ui-rounded-full" />
            <div className="ui-flex ui-flex-1 ui-ml-4 ui-items-center ui-gap-2.5">
              {/* Label skeleton */}
              <Skeleton className="ui-h-5 ui-w-24" />
              {/* Active session badge skeleton (shown for first item) */}
              {i === 0 && <Skeleton className="ui-h-6 ui-w-28 ui-rounded-sm" />}
            </div>
          </div>
          {/* Action buttons skeleton */}
          <div className="ui-flex ui-items-center ui-gap-4">
            <Skeleton className="ui-w-4 ui-h-4 ui-rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
