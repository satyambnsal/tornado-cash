import React, { useContext, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext, AuthContextProps } from "./AuthContext";
import { CloseIcon, WalletIcon } from "./ui";
import { ExternalLinkIcon } from "./ui/icons/ExternalLink";
import { EllipsisButton } from "./ui/buttons/ellipsis-button";
import { NetworkBadge } from "./ui/NetworkBadge";
import { useSmartAccount } from "../hooks";
import { truncateAddress } from "../utils";
import xionLogo from "../assets/logo.png";
import { cn } from "../utils/classname-util";
import { DashboardAccountDialog } from "./DashboardAccountDialog";
import { getExplorerUrl, getStakingUrl } from "../config";

interface SidebarProps {
  onClose?: VoidFunction;
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const { isMainnet, setIsOpen } = useContext(AuthContext) as AuthContextProps;
  const { data: account } = useSmartAccount();
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);

  const NAV_OPTIONS = React.useMemo(
    () => [
      { text: "Home", path: "/" },
      {
        text: "History",
        path: getExplorerUrl(),
        external: true,
      },
      {
        text: "Staking",
        path: getStakingUrl(),
        external: true,
      },
    ],
    [],
  );

  const renderNavOptions = () => {
    return NAV_OPTIONS.map((option) => {
      if (option.external) {
        return (
          <a
            key={option.text}
            href={option.path}
            target="_blank"
            className={cn(
              "ui-text-[32px] ui-font-bold ui-leading-[120%] ui-text-text-secondary",
            )}
            rel="noreferrer"
            onClick={onClose}
          >
            <span className="ui-flex ui-items-center ui-gap-2.5">
              {option.text}
              <ExternalLinkIcon size={24} />
            </span>
          </a>
        );
      }
      return (
        <Link
          key={option.text}
          to={option.path}
          className={cn(
            "ui-text-[32px] ui-leading-[120%] ui-font-bold ui-text-text-secondary",
            { "ui-text-text-primary": pathname === option.path },
          )}
          onClick={onClose}
        >
          {option.text}
        </Link>
      );
    });
  };

  return (
    <div className="ui-min-h-dvh ui-bg-background ui-flex ui-flex-col ui-w-[320px] ui-px-6">
      {/* Header with Logo and Network */}
      <div className="ui-flex ui-items-center ui-justify-between ui-py-4">
        <div className="ui-flex ui-items-center ui-space-x-1.5">
          <img
            src={xionLogo}
            alt="XION Logo"
            width="90"
            height="32"
            className="ui-mb-1.5 ui-brightness-0"
          />
          <NetworkBadge isMainnet={isMainnet} />
        </div>
        {onClose && (
          <button onClick={onClose} className="ui-text-text-primary">
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="ui-flex ui-flex-col ui-justify-center ui-flex-1 ui-gap-6">
        {renderNavOptions()}
      </div>

      <div className="ui-py-6">
        <div className="ui-flex ui-items-center ui-justify-between">
          <div className="ui-flex ui-items-center ui-space-x-2.5">
            <WalletIcon
              color="currentColor"
              backgroundColor="hsla(var(--background), 1)"
            />
            <span className="ui-text-body-lg ui-font-bold">
              {account?.id && truncateAddress(account.id)}
            </span>
          </div>
          <EllipsisButton
            onClick={() => {
              if (account?.id) {
                setShowDashboardDialog(true);
              } else {
                setIsOpen(true);
              }
            }}
          />
        </div>
      </div>

      <DashboardAccountDialog
        isOpen={showDashboardDialog}
        onClose={() => setShowDashboardDialog(false)}
      />
    </div>
  );
}
