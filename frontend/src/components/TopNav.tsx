import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext, AuthContextProps } from "./AuthContext";
import xionLogo from "../assets/logo.png";
import { useSmartAccount } from "../hooks";
import { WalletIcon } from "./ui/icons/Wallet";
import { ExternalLinkIcon } from "./ui/icons/ExternalLink";
import { Button } from "./ui/button";
import { NetworkBadge } from "./ui/NetworkBadge";
import { Sidebar } from "./Sidebar";
import { truncateAddress } from "../utils";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { cn } from "../utils/classname-util";
import { DashboardAccountDialog } from "./DashboardAccountDialog";

export function TopNav() {
  const location = useLocation();
  const pathname = location.pathname;
  const { isMainnet, setIsOpen, chainInfo } = useContext(
    AuthContext,
  ) as AuthContextProps;
  const { data: account } = useSmartAccount();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);
  const isAboveMobile = useBreakpoint("md");

  useEffect(() => {
    if (isAboveMobile) {
      setShowMobileSidebar(false);
    }
  }, [isAboveMobile]);

  const NAV_OPTIONS = React.useMemo(
    () => [
      { text: "Home", path: "/" },
      {
        text: "History",
        path: isMainnet
          ? `https://www.mintscan.io/xion/address/${account?.id}`
          : chainInfo?.chainId === "xion-testnet-2"
            ? `https://www.mintscan.io/xion-testnet/address/${account?.id}`
            : "https://explorer.burnt.com/xion-testnet-1/",
        external: true,
      },
      {
        text: "Staking",
        path: isMainnet
          ? "https://staking.burnt.com"
          : "https://staking.testnet.burnt.com",
        external: true,
      },
    ],
    [isMainnet, chainInfo?.chainId],
  );

  return (
    <>
      <nav className="ui-w-full ui-px-6 ui-py-4">
        <div className="ui-max-w-7xl ui-mx-auto ui-flex ui-items-center ui-justify-between">
          <div className="ui-flex ui-items-center ui-space-x-2.5">
            <img
              src={xionLogo}
              alt="XION Logo"
              width="90"
              height="32"
              className="ui-mb-1.5 ui-brightness-0"
            />
            <NetworkBadge isMainnet={isMainnet} />
          </div>

          <div className="ui-hidden md:ui-flex ui-items-center ui-justify-center ui-flex-1 ui-gap-6">
            {NAV_OPTIONS.map((option) => {
              if (option.external) {
                return (
                  <a
                    key={option.text}
                    href={option.path}
                    target="_blank"
                    className="ui-text-text-secondary hover:ui-text-text-primary ui-transition-colors"
                    rel="noreferrer"
                  >
                    <span className="ui-flex ui-items-center ui-font-bold">
                      {option.text}
                      <ExternalLinkIcon size={16} className="ui-ml-1" />
                    </span>
                  </a>
                );
              }
              return (
                <Link
                  key={option.text}
                  to={option.path}
                  className={cn(
                    "ui-transition-colors ui-font-bold ui-text-text-secondary hover:ui-text-text-primary",
                    { "!ui-text-text-primary": pathname === option.path },
                  )}
                >
                  {option.text}
                </Link>
              );
            })}
          </div>

          <div className="ui-flex ui-items-center ui-space-x-1.5">
            <div className="ui-hidden md:ui-block">
              <Button
                size="small"
                onClick={() => {
                  if (account?.id) {
                    setShowDashboardDialog(true);
                  } else {
                    setIsOpen(true);
                  }
                }}
                className="!ui-px-2.5 !ui-py-1.5 ui-bg-transparent hover:ui-bg-surface-page"
              >
                <div className="ui-flex ui-items-center ui-space-x-1.5">
                  <WalletIcon
                    color="currentColor"
                    backgroundColor="hsla(var(--background), 1)"
                  />
                  <span className="ui-text-text-primary ui-font-bold">
                    {account?.id && truncateAddress(account.id)}
                  </span>
                </div>
              </Button>
            </div>

            <Button
              onClick={() => setShowMobileSidebar(true)}
              className="md:ui-hidden !ui-p-1.5 ui-bg-transparent hover:ui-bg-surface-page"
            >
              <div className="ui-flex ui-flex-col ui-items-end ui-gap-1.5">
                <div className="ui-w-[24px] ui-h-0.5 ui-bg-text-primary" />
                <div className="ui-w-[16px] ui-h-0.5 ui-bg-text-primary" />
              </div>
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "ui-fixed ui-inset-0 ui-z-30 ui-transition-all ui-duration-200",
          showMobileSidebar
            ? "ui-opacity-100"
            : "ui-opacity-0 ui-pointer-events-none",
        )}
      >
        <div className="ui-absolute ui-inset-0 ui-transition-all ui-duration-200 ui-bg-black/50 ui-backdrop-blur-sm" />
        <div
          className={cn(
            "ui-relative ui-z-10 ui-flex ui-justify-end ui-transition-transform ui-duration-300 ui-ease-out",
            showMobileSidebar
              ? "ui-translate-x-0 ui-delay-75"
              : "ui-translate-x-full",
          )}
        >
          <Sidebar onClose={() => setShowMobileSidebar(false)} />
        </div>
      </div>

      <DashboardAccountDialog
        isOpen={showDashboardDialog}
        onClose={() => setShowDashboardDialog(false)}
      />
    </>
  );
}
