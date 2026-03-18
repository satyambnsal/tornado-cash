import React from "react";
import type { ContractGrantDescription } from "@burnt-labs/account-management";
import { PermissionItem } from "./PermissionItem";

interface LegacyPermissionsListProps {
  contracts: ContractGrantDescription[];
  bank: { denom: string; amount: string }[];
  stake: boolean;
  appName?: string;
}

export const LegacyPermissionsList: React.FC<LegacyPermissionsListProps> = ({
  contracts,
  bank,
  stake,
  appName,
}) => {
  let itemIndex = 0;

  const contractAddresses =
    contracts.length > 0
      ? contracts
          .map((c) => (typeof c === "string" ? c : c.address))
          .join(", ")
      : undefined;

  return (
    <div>
      {appName && (
        <p className="ui-mb-2 ui-text-body ui-text-text-secondary ui-font-medium ui-pl-2.5">
          This will allow {appName} to:
        </p>
      )}
      <div className="ui-flex ui-flex-col ui-gap-1">
        {contracts.length > 0 && (
          <PermissionItem
            label="Permission to execute smart contracts"
            description={contractAddresses}
            expandable={true}
            index={itemIndex++}
          />
        )}

        {stake && (
          <PermissionItem
            label="Permission to manage staking operations"
            index={itemIndex++}
          />
        )}

        {bank.length > 0 && (
          <PermissionItem
            label={`Permission to send tokens with a spend limit of ${bank.map(({ denom, amount }) => `${amount} ${denom}`).join(", ")}`}
            index={itemIndex++}
          />
        )}

        <PermissionItem
          label="Log you in to their app"
          index={itemIndex}
        />
      </div>
    </div>
  );
};
