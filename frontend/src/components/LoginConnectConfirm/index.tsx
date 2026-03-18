import React, { useContext, useEffect, useMemo, useState } from "react";
import { Button } from "../ui";
import { Skeleton } from "../ui/skeleton";
import { useSmartAccount } from "../../hooks";
import { DashboardMessageType } from "../../messaging/types";
import { useXionDisconnect } from "../../hooks/useXionDisconnect";
import { AuthContext, AuthContextProps } from "../AuthContext";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useTreasuryDiscovery } from "../../hooks/useTreasuryDiscovery";
import { safeRedirectOrDisconnect } from "../../utils/redirect-utils";
import {
  getDomainAndProtocol,
} from "@burnt-labs/account-management";
import { SecuredByXion } from "../ui/SecuredByXion";
import { truncateAddress } from "../../utils";
import { cn } from "../../utils/classname-util";
import { CopyIcon, CheckIcon } from "../ui/icons";

// Inline SVG icons used only in this component
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

interface LoginConnectConfirmProps {
  /** Optional treasury address — used to fetch app branding (icon, name, domain) */
  treasury?: string;
  /** Optional callback when connection is confirmed (for iframe mode) */
  onApprove?: () => void;
  /** Optional callback when connection is denied (for iframe mode) */
  onDeny?: () => void;
}

export const LoginConnectConfirm = ({
  treasury,
  onApprove,
  onDeny: onDenyCallback,
}: LoginConnectConfirmProps) => {
  const { data: account } = useSmartAccount();
  const { redirect_uri, state, mode } = useQueryParams([
    "redirect_uri",
    "state",
    "mode",
  ]);
  const { xionDisconnect, switchAccount } = useXionDisconnect();
  const { setAbstraxionError } = useContext(AuthContext) as AuthContextProps;

  const [showSuccess, setShowSuccess] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch treasury branding when a treasury address is provided
  const {
    data: treasuryData,
    isLoading: isTreasuryQueryLoading,
  } = useTreasuryDiscovery(treasury);

  const treasuryParams = treasuryData?.params || {
    redirect_url: "",
    icon_url: "",
    metadata: "",
  };

  // Whether domain info comes from the treasury (verified) or just the redirect_uri (unverified)
  const hasTreasuryBranding = !!treasuryParams.redirect_url;

  // Derive app display name and domain from treasury params or redirect_uri
  const appDomain = useMemo(() => {
    if (treasuryParams.redirect_url) {
      return getDomainAndProtocol(treasuryParams.redirect_url);
    }
    if (redirect_uri) {
      return getDomainAndProtocol(redirect_uri);
    }
    return undefined;
  }, [treasuryParams.redirect_url, redirect_uri]);

  const appFriendlyName = useMemo(() => {
    const sourceUrl = treasuryParams.redirect_url || redirect_uri;
    if (!sourceUrl) return undefined;
    try {
      const hostname = new URL(sourceUrl).hostname;
      const parts = hostname.split(".");
      if (parts.length <= 1 || /^\d+$/.test(parts[parts.length - 1])) {
        return hostname;
      }
      return parts[parts.length - 2];
    } catch {
      return appDomain;
    }
  }, [treasuryParams.redirect_url, redirect_uri, appDomain]);

  const appDisplayName = appFriendlyName || "A 3rd party";

  // Only show the app icon when the treasury provides one
  const appIconUrl = treasuryParams.icon_url || undefined;

  // --- Success handler: notify parent / redirect / close ---
  useEffect(
    function handleSuccessCallback() {
      if (!showSuccess) return;

      if (onApprove) {
        const timer = setTimeout(() => onApprove(), 500);
        return () => clearTimeout(timer);
      }

      if (mode === "popup") {
        const timer = setTimeout(() => {
          if (window.opener && redirect_uri) {
            try {
              const targetOrigin = new URL(redirect_uri).origin;
              window.opener.postMessage(
                { type: DashboardMessageType.CONNECT_SUCCESS, address: account?.id },
                targetOrigin,
              );
            } catch {
              // opener gone or invalid redirect_uri
            }
          }
          setTimeout(() => window.close(), 150);
        }, 500);
        return () => clearTimeout(timer);
      }

      if (mode === "inline") {
        const timer = setTimeout(() => {
          if (redirect_uri) {
            try {
              const targetOrigin = new URL(redirect_uri).origin;
              window.parent.postMessage(
                { type: DashboardMessageType.CONNECT_SUCCESS, address: account?.id },
                targetOrigin,
              );
            } catch {
              // parent unreachable or invalid redirect_uri
            }
          }
          const url = new URL(window.location.href);
          url.searchParams.set("granted", "true");
          window.history.replaceState({}, "", url.toString());
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, 500);
        return () => clearTimeout(timer);
      }

      if (redirect_uri) {
        const timer = setTimeout(() => {
          safeRedirectOrDisconnect(
            redirect_uri,
            setAbstraxionError,
            xionDisconnect,
            account?.id,
            true,
            state || undefined,
          );
        }, 500);
        return () => clearTimeout(timer);
      }
    },
    [showSuccess, mode, redirect_uri, account?.id, setAbstraxionError, xionDisconnect, state, onApprove],
  );

  const handleDeny = () => {
    if (onDenyCallback) {
      onDenyCallback();
      return;
    }

    if (mode === "popup") {
      if (window.opener && redirect_uri) {
        try {
          const targetOrigin = new URL(redirect_uri).origin;
          window.opener.postMessage({ type: DashboardMessageType.CONNECT_REJECTED }, targetOrigin);
        } catch {
          // opener gone or invalid redirect_uri
        }
      }
      setTimeout(() => window.close(), 150);
      return;
    }

    if (mode === "inline") {
      if (redirect_uri) {
        try {
          const targetOrigin = new URL(redirect_uri).origin;
          window.parent.postMessage({ type: DashboardMessageType.CONNECT_REJECTED }, targetOrigin);
        } catch {
          // parent unreachable or invalid redirect_uri
        }
      }
      return;
    }

    safeRedirectOrDisconnect(
      redirect_uri,
      setAbstraxionError,
      xionDisconnect,
      undefined,
      true,
      state || undefined,
    );
  };

  const handleCopyAddress = () => {
    if (account?.id) {
      navigator.clipboard.writeText(account.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const renderContent = () => {
    // --- Success state ---
    if (showSuccess) {
      if (mode === "inline") {
        return (
          <div className="ui-flex ui-flex-col ui-items-center ui-py-12 ui-text-center">
            <div className="ui-flex ui-h-16 ui-w-16 ui-items-center ui-justify-center ui-rounded-full ui-bg-accent-trust/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ui-text-accent-trust">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">
              Connected
            </h2>
          </div>
        );
      }

      return (
        <div className="ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
          <div className="ui-flex ui-h-16 ui-w-16 ui-items-center ui-justify-center ui-rounded-full ui-bg-accent-trust/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ui-text-accent-trust">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">
            Connected
          </h2>
          <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">
            {mode === "popup"
              ? "This window will close automatically."
              : "You will now be redirected to your application."}
          </p>
        </div>
      );
    }

    // --- Confirm state ---
    return (
      <>
        {/* App Identity */}
        <div className="ui-flex ui-flex-col ui-items-center ui-text-center">
          {treasury && isTreasuryQueryLoading ? (
            <div className="ui-flex ui-flex-col ui-items-center ui-gap-2.5">
              <Skeleton className="ui-h-10 ui-w-10 ui-rounded-button" />
              <Skeleton className="ui-h-7 ui-w-32" />
              <Skeleton className="ui-h-5 ui-w-40" />
            </div>
          ) : (
            <>
              {appIconUrl && (
                <img
                  src={appIconUrl}
                  alt="App Icon"
                  width={42}
                  height={42}
                  className="ui-rounded-button ui-object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <h2 className="ui-mt-1.5 ui-text-title ui-text-text-primary">
                {appDisplayName}
              </h2>
              {appDomain && hasTreasuryBranding && (
                <div className="ui-mt-1.5 ui-inline-flex ui-items-center ui-gap-1 ui-rounded-full ui-border ui-border-surface-border ui-bg-surface-page ui-px-2.5 ui-py-0.5">
                  <LockIcon className="ui-text-accent-trust" />
                  <span className="ui-text-caption ui-text-text-muted">
                    {appDomain}
                  </span>
                </div>
              )}
              <p className="ui-mt-4 ui-text-body ui-text-text-muted">
                wants to confirm your identity
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="ui-mt-6 ui-flex ui-flex-col ui-items-center ui-gap-2.5">
          <Button
            className="ui-w-full"
            onClick={() => setShowSuccess(true)}
          >
            <span className="ui-font-bold">Connect</span>
          </Button>
          <Button variant="text" size="text" onClick={handleDeny}>
            Deny
          </Button>
          <Button
            variant="text"
            size="text"
            className="ui-text-caption ui-text-text-muted"
            onClick={switchAccount}
          >
            Use a different account
          </Button>
        </div>

        {/* Footer */}
        <div className="ui-mt-auto ui-pt-6 ui-flex ui-flex-col ui-items-center ui-gap-1">
          <button
            type="button"
            onClick={() => setShowAddress((v) => !v)}
            className="ui-transition-opacity ui-duration-fast hover:ui-opacity-70"
          >
            <SecuredByXion />
          </button>
          {showAddress && account?.id && (
            <button
              type="button"
              onClick={handleCopyAddress}
              className="ui-flex ui-items-center ui-gap-1 ui-animate-fade-in ui-transition-opacity ui-duration-fast hover:ui-opacity-70"
            >
              <span
                className={cn(
                  "ui-text-caption",
                  copied ? "ui-text-accent-trust" : "ui-text-text-muted",
                )}
              >
                {copied ? "Copied!" : truncateAddress(account.id)}
              </span>
              {copied ? (
                <CheckIcon color="#0D9488" />
              ) : (
                <CopyIcon color="var(--text-muted)" width={10} height={12} />
              )}
            </button>
          )}
        </div>
      </>
    );
  };

  return <div className="ui-animate-scale-in ui-flex ui-flex-col ui-min-h-full">{renderContent()}</div>;
};
