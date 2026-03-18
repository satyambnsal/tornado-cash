import React, { useMemo, useState } from "react";
import { truncateAddress } from "../utils";
import { ChevronDownIcon } from "./ui/icons";
import { Button } from "./ui";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";
import { useQueryParams } from "../hooks/useQueryParams";
import { useTreasuryDiscovery } from "../hooks/useTreasuryDiscovery";
import { PermissionsList } from "./LoginGrantApproval/PermissionsList";
import { LegacyPermissionsList } from "./LoginGrantApproval/LegacyPermissionsList";
import { SecuredByXion } from "./ui/SecuredByXion";

const LockIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

interface InlineConnectedViewProps {
  account: { id: string };
  redirectUri: string | null | undefined;
  xionDisconnect: () => void;
}

export function InlineConnectedView({
  account,
  redirectUri,
  xionDisconnect,
}: InlineConnectedViewProps) {
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  // Read grant params directly from URL (they stay in the URL after grant approval)
  const { treasury, contracts, stake, bank } = useQueryParams([
    "treasury",
    "contracts",
    "stake",
    "bank",
  ]);

  const appDomain = useMemo(() => {
    if (!redirectUri) return null;
    try {
      return new URL(redirectUri).host;
    } catch {
      return null;
    }
  }, [redirectUri]);

  // Re-query treasury contract for permissions (React Query cache serves instantly if recent)
  const { data: treasuryData, isLoading: isTreasuryLoading } =
    useTreasuryDiscovery(treasury || undefined);

  const permissions = treasuryData?.permissionDescriptions || [];

  // Parse legacy grant params
  const legacyGrants = useMemo(() => {
    if (treasury) return null;

    let contractsArray: string[] = [];
    let bankArray: { denom: string; amount: string }[] = [];
    const hasStake = Boolean(stake);

    if (contracts) {
      try {
        const parsed = JSON.parse(contracts);
        contractsArray = Array.isArray(parsed) ? parsed : contracts.split(",");
      } catch {
        contractsArray = contracts.split(",");
      }
    }
    if (bank) {
      try {
        bankArray = JSON.parse(bank);
      } catch {
        bankArray = [];
      }
    }

    if (contractsArray.length === 0 && !hasStake && bankArray.length === 0) return null;
    return { contracts: contractsArray, stake: hasStake, bank: bankArray };
  }, [treasury, contracts, stake, bank]);

  return (
    <div className="ui-flex ui-flex-col ui-items-center ui-min-h-screen ui-p-6 ui-bg-background">
      {/* Spacer — pushes content to vertical center */}
      <div className="ui-flex-1" />

      {/* Main content */}
      <div className="ui-flex ui-flex-col ui-items-center">
        {/* Status heading */}
        <h2 className="ui-text-title ui-text-text-primary">Connected</h2>

        {/* App domain pill */}
        {appDomain && (
          <div className="ui-mt-1.5 ui-inline-flex ui-items-center ui-gap-1 ui-rounded-full ui-border ui-border-surface-border ui-bg-surface-page ui-px-2.5 ui-py-0.5">
            <LockIcon className="ui-text-accent-trust" />
            <span className="ui-text-caption ui-text-text-muted">
              {appDomain}
            </span>
          </div>
        )}

        {/* More information — permissions + account address */}
        <Collapsible
            open={permissionsOpen}
            onOpenChange={setPermissionsOpen}
            className="ui-mt-5 ui-w-full ui-max-w-[300px]"
          >
            <CollapsibleTrigger className="ui-flex ui-w-full ui-items-center ui-justify-between ui-px-2.5 ui-py-2 ui-rounded-button ui-cursor-pointer hover:ui-bg-surface-page/60">
              <span className="ui-text-body ui-text-text-secondary">
                More information
              </span>
              <ChevronDownIcon
                isUp={permissionsOpen}
                className="ui-h-4 ui-w-4 ui-text-text-muted"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ui-mt-1">
                {treasury ? (
                  <PermissionsList
                    permissions={permissions}
                    isLoading={isTreasuryLoading}
                  />
                ) : legacyGrants ? (
                  <LegacyPermissionsList
                    contracts={legacyGrants.contracts}
                    bank={legacyGrants.bank}
                    stake={legacyGrants.stake}
                  />
                ) : null}
                <p className="ui-mt-2 ui-px-2.5 ui-text-caption ui-text-text-muted">
                  Account: {truncateAddress(account.id)}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

        {/* Disconnect button (outlined) */}
        <Button
          variant="secondary"
          size="small"
          className="ui-mt-6"
          onClick={() => {
            xionDisconnect();
          }}
        >
          Disconnect
        </Button>
      </div>

      {/* Spacer — pushes footer to bottom */}
      <div className="ui-flex-1" />

      {/* Footer */}
      <SecuredByXion />
    </div>
  );
}
