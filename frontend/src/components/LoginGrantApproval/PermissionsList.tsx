import React from "react";
import { PermissionDescription } from "../../types/treasury-types";
import { Skeleton } from "../ui/skeleton";
import { useAssetList } from "../../hooks/useAssetList";
import { formatIBCAddresses } from "../../utils";
import { PermissionItem } from "./PermissionItem";

interface PermissionsListProps {
  permissions: PermissionDescription[];
  isLoading?: boolean;
  appName?: string;
}

const LoadingSkeleton = () => (
  <div className="ui-space-y-3">
    {[1, 2].map((i) => (
      <div key={i} className="ui-space-y-2">
        <Skeleton className="ui-h-5 ui-w-full" />
        <Skeleton className="ui-h-4 ui-w-3/4" />
      </div>
    ))}
  </div>
);

export const PermissionsList: React.FC<PermissionsListProps> = ({
  permissions,
  isLoading = false,
  appName,
}) => {
  const { data: assetData, isLoading: isLoadingAssets } = useAssetList();
  const { getAssetByDenom } = assetData || { getAssetByDenom: () => undefined };

  if (isLoading || isLoadingAssets || !assetData) {
    return <LoadingSkeleton />;
  }

  return (
    <div>
      {appName && (
        <p className="ui-mb-2 ui-text-body ui-text-text-secondary ui-font-medium ui-pl-2.5">
          This will allow {appName} to:
        </p>
      )}
      <div className="ui-flex ui-flex-col ui-gap-1">
        {permissions.map((permission, index) => {
          const formattedTitle = formatIBCAddresses(
            permission.authorizationDescription,
            getAssetByDenom,
          );
          const hasContracts =
            permission.contracts && permission.contracts.length > 0;
          const contractList = hasContracts
            ? permission.contracts!
                .filter(Boolean)
                .map((c) => formatIBCAddresses(c!, getAssetByDenom))
                .join(", ")
            : undefined;

          return (
            <PermissionItem
              key={index}
              label={`"${permission.dappDescription}" - ${formattedTitle}`}
              description={contractList}
              expandable={hasContracts}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
};
