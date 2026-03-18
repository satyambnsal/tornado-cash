import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccountInfo } from "./AccountInfo";
import { AuthContext } from "./AuthContext";
import { Overview } from "./Overview";
import { TopNav } from "./TopNav";
import { LoginModal } from "./LoginModal";
import { useSmartAccount } from "../hooks";
import { useQueryParams } from "../hooks/useQueryParams";
import { Banner } from "./ui";
import { Dialog, DialogContent } from "./ui";
import { AccountMigration } from "./AccountMigration";
import { useWalletChangeListener } from "../hooks/useWalletChangeListener";
import { SignTransactionView } from "./SignTransactionView";
import { useXionDisconnect } from "../hooks/useXionDisconnect";
import { InlineConnectedView } from "./InlineConnectedView";
import { IframeMessageHandler } from "../messaging/handler";
import type { ConnectResponse, SignTransactionPayload, SignTransactionResponse, SignAndBroadcastResult } from "../messaging/types";
import { DashboardMessageType } from "../messaging/types";
import { AuthStateManager } from "../auth/AuthStateManager";

export function App() {
  const { grantee, mode, redirect_uri, granted, theme } =
    useQueryParams([
      "grantee",
      "mode",
      "redirect_uri",
      "granted",
      "theme",
    ]);

  // Apply theme from query param: "dark", "light", or "system" (follows OS preference)
  useEffect(() => {
    if (!theme) return;

    const applyTheme = (resolvedTheme: "light" | "dark") => {
      document.documentElement.setAttribute("data-theme", resolvedTheme);
    };

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    if (theme === "dark" || theme === "light") {
      applyTheme(theme);
    }
  }, [theme]);

  // In iframe modes (inline/sign/popup), make html+body transparent so the
  // parent page shows through behind the semi-transparent overlay.
  useEffect(() => {
    if (mode === "inline" || mode === "sign" || mode === "popup") {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
      return () => {
        document.documentElement.style.background = "";
        document.body.style.background = "";
      };
    }
  }, [mode]);

  const { data: account, updateAbstractAccountCodeId } = useSmartAccount();
  const { isOpen, setIsOpen } = useContext(AuthContext);

  // Listen for wallet account changes (Keplr/MetaMask)
  useWalletChangeListener();

  const { xionDisconnect } = useXionDisconnect();

  // mode=inline: Dashboard is running inside an inline iframe embedded by a dApp.
  // Show a minimal connected view instead of the full dashboard.
  const isInlineMode = mode === "inline";

  // Ref to hold the pending CONNECT promise resolver.
  // Resolved when auth + grants complete (via onApprove callback or no-grants useEffect).
  const connectResolverRef = useRef<{
    resolve: (value: ConnectResponse) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // ─── Inline mode: direct signing state ──────────────────────────────────────
  // Pending sign-only request (SIGN_TRANSACTION)
  const signRequestRef = useRef<{
    transaction: SignTransactionPayload["transaction"];
    signerAddress: string;
    resolve: (value: SignTransactionResponse) => void;
    reject: (error: Error) => void;
  } | null>(null);
  // Pending sign-and-broadcast request (SIGN_AND_BROADCAST) — separate ref so
  // the resolve is typed to the actual broadcast result, not SignTransactionResponse.
  const broadcastRequestRef = useRef<{
    transaction: SignTransactionPayload["transaction"];
    signerAddress: string;
    resolve: (value: { signedTx: SignAndBroadcastResult }) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [showSigningModal, setShowSigningModal] = useState(false);

  // Track whether the SDK requested a disconnect (via DISCONNECT/HARD_DISCONNECT message).
  // When the SDK disconnects, it's about to remove the iframe — render nothing to avoid
  // a brief flash of LoginModal. This does NOT apply to "Use a different account" flows
  // where the user wants to re-login within the same iframe.
  const sdkDisconnectRef = useRef(false);

  // ─── IframeMessageHandler for inline mode ────────────────────────────────────
  // Replaces raw LOGOUT/CONNECT_SUCCESS/CONNECT_REJECTED postMessage listeners.
  // Provides defense-in-depth: rate limiting, replay detection, payload validation,
  // HTTPS enforcement, and origin-scoped request logging.
  useEffect(() => {
    if (!isInlineMode) return;

    const parentOrigin = redirect_uri ? new URL(redirect_uri).origin : null;

    const handler = new IframeMessageHandler({
      onConnect: (origin, _payload) => {
        // Store parent origin for scoped HARD_DISCONNECT postMessage
        AuthStateManager.setParentOrigin(origin);

        // Return a Promise that stays open until auth + grants complete.
        // It will be resolved by handleGrantApproved or the no-grants useEffect.
        return new Promise<ConnectResponse>((resolve, reject) => {
          connectResolverRef.current = { resolve, reject };
        });
      },

      onDisconnect: async (_origin) => {
        sdkDisconnectRef.current = true;
        await xionDisconnect();
        return {};
      },

      onGetAddress: (_origin) => {
        return { address: account?.id ?? null };
      },

      // Direct signing: show SigningModal, resolve when user approves/rejects
      onSignTransaction: (_origin, payload) => {
        return new Promise<SignTransactionResponse>((resolve, reject) => {
          signRequestRef.current = { transaction: payload.transaction, signerAddress: payload.signerAddress, resolve, reject };
          setShowSigningModal(true);
        });
      },
      onSignAndBroadcast: (_origin, payload) => {
        return new Promise((resolve, reject) => {
          broadcastRequestRef.current = { transaction: payload.transaction, signerAddress: payload.signerAddress, resolve, reject };
          setShowSigningModal(true);
        });
      },
      onAddAuthenticator: async () => {
        throw new Error("Add authenticator not available in inline mode");
      },
      onRemoveAuthenticator: async () => {
        throw new Error("Remove authenticator not available in inline mode");
      },
      onRequestGrant: async () => {
        throw new Error("Request grant not available in inline mode");
      },
    }, parentOrigin ?? undefined);

    // Signal to the SDK that the handler is mounted and ready for MessageChannel requests.
    // Scoped to redirect_uri origin so only the embedding dApp receives this.
    if (parentOrigin) {
      window.parent.postMessage({ type: DashboardMessageType.IFRAME_READY }, parentOrigin);
    }

    return () => handler.destroy();
  }, [isInlineMode, redirect_uri]);

  // ─── Grant approval / denial callbacks (threaded to LoginModal) ──────────────
  const handleGrantApproved = useCallback(() => {
    // Set ?granted=true in URL so App.tsx renders InlineConnectedView
    const url = new URL(window.location.href);
    url.searchParams.set("granted", "true");
    window.history.replaceState({}, "", url.toString());
    // Trigger useQueryParams re-read
    window.dispatchEvent(new PopStateEvent("popstate"));

    // Resolve the pending CONNECT promise with the user's address
    if (connectResolverRef.current && account?.id) {
      connectResolverRef.current.resolve({ address: account.id });
      connectResolverRef.current = null;
    }
  }, [account?.id]);

  const handleGrantDenied = useCallback(() => {
    if (connectResolverRef.current) {
      connectResolverRef.current.reject(new Error("Connection rejected by user"));
      connectResolverRef.current = null;
    }
  }, []);

  // ─── Inline mode: resolve connectResolverRef after user confirms ─────────────
  // Fires when `?granted=true` is set (by LoginGrantApproval's handleSuccessCallback
  // which calls onApprove → handleGrantApproved). Acts as a safety-net backup in
  // case connectResolverRef wasn't already resolved in handleGrantApproved.
  useEffect(() => {
    if (!isInlineMode) return;
    if (!account?.id) return;
    if (!!grantee && !granted) return; // Confirmation still pending
    if (!connectResolverRef.current) return;

    connectResolverRef.current.resolve({ address: account.id });
    connectResolverRef.current = null;
  }, [isInlineMode, account?.id, grantee, granted]);

  // ─── Inline signing result handler ──────────────────────────────────────────
  const handleSignResult = useCallback((data: Record<string, unknown>) => {
    if (broadcastRequestRef.current) {
      const req = broadcastRequestRef.current;
      broadcastRequestRef.current = null;
      if (data.type === DashboardMessageType.SIGN_SUCCESS && data.txHash) {
        req.resolve({ signedTx: { transactionHash: data.txHash as string } });
      } else {
        req.reject(new Error((data.message as string) || "User rejected"));
      }
    } else if (signRequestRef.current) {
      const req = signRequestRef.current;
      signRequestRef.current = null;
      if (data.type === DashboardMessageType.SIGN_SUCCESS && data.txHash) {
        req.resolve({ signedTx: { transactionHash: data.txHash } } as unknown as SignTransactionResponse);
      } else {
        req.resolve({ error: (data.message as string) || "User rejected" } as unknown as SignTransactionResponse);
      }
    }
    setShowSigningModal(false);
  }, []);

  if (isInlineMode) {
    // Signing request pending: show SignTransactionView (same as popup mode=sign)
    const activeSignRequest = signRequestRef.current ?? broadcastRequestRef.current;
    if (showSigningModal && activeSignRequest && account?.id) {
      return (
        <div className="ui-flex ui-w-full ui-h-svh ui-z-[50] ui-fixed ui-flex-1 ui-items-center ui-justify-center ui-overflow-y-auto ui-p-6">
          <Banner className="ui-fixed ui-top-0 ui-left-0 ui-z-[10001]" />
          <Dialog open onOpenChange={() => null}>
            <DialogContent>
              <SignTransactionView
                transaction={activeSignRequest.transaction}
                granterAddress={activeSignRequest.signerAddress}
                onResult={handleSignResult}
              />
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // After SDK-initiated disconnect, render nothing. The SDK will remove the iframe
    // momentarily (via HARD_DISCONNECT postMessage → removeIframe). Rendering LoginModal
    // would cause a brief flash before the iframe is torn down.
    // This does NOT trigger for "Use a different account" — that uses switchAccount()
    // which doesn't set sdkDisconnectRef.
    if (!account?.id && sdkDisconnectRef.current) {
      return null;
    }

    if (!account?.id || (!granted && !!grantee)) {
      // Not authenticated or confirmation still pending: show LoginModal
      return (
        <div className="ui-flex ui-w-full ui-h-svh ui-z-[50] ui-fixed ui-flex-1 ui-items-center ui-justify-center ui-overflow-y-auto ui-p-6">
          <Banner className="ui-fixed ui-top-0 ui-left-0 ui-z-[10001]" />
          <LoginModal
            onClose={() => null}
            isOpen={true}
            onApprove={handleGrantApproved}
            onDeny={handleGrantDenied}
          />
        </div>
      );
    }

    // Authenticated (grants completed or none requested): show connected view
    return <InlineConnectedView account={account} redirectUri={redirect_uri} xionDisconnect={xionDisconnect} />;
  }


  // mode=sign: SDK opened this window to sign a transaction directly.
  // If the user is logged in, show the SignTransactionView. Otherwise show
  // LoginModal first — after login, App re-renders and hits this branch.
  const isSignMode = mode === "sign";

  if (isSignMode) {
    return (
      <div className="ui-flex ui-w-full ui-h-svh ui-z-[50] ui-fixed ui-flex-1 ui-items-center ui-justify-center ui-overflow-y-auto ui-p-6">
        <Banner className="ui-fixed ui-top-0 ui-left-0 ui-z-[10001]" />
        {account?.id ? (
          <Dialog open onOpenChange={() => null}>
            <DialogContent>
              <SignTransactionView />
            </DialogContent>
          </Dialog>
        ) : (
          <LoginModal onClose={() => null} isOpen={true} />
        )}
      </div>
    );
  }

  return (
    <>
      {// Show LoginModal when not yet authenticated, or when a grantee is present
      // and the user hasn't confirmed yet. LoginGrantApproval handles all connect-only,
      // empty-treasury, and full-grant flows and sends CONNECT_SUCCESS when done.
      !account?.id || !!grantee ? (
        <div className="ui-flex ui-w-full ui-h-svh ui-z-[50] ui-fixed ui-flex-1 ui-items-center ui-justify-center ui-overflow-y-auto ui-p-6">
          <Banner className="ui-fixed ui-top-0 ui-left-0 ui-z-[10001]" />
          <LoginModal onClose={() => null} isOpen={true} />
        </div>
      ) : (
        <div className="ui-flex ui-flex-col ui-min-h-screen ui-bg-background">
          <Banner />
          <TopNav />

          <main className="ui-flex-1 ui-overflow-y-auto ui-p-6">
            <div className="ui-max-w-7xl ui-mx-auto">
              <div className="ui-relative">
                <LoginModal onClose={() => setIsOpen(false)} isOpen={isOpen} />
                {/* Tiles */}
                <div className="ui-mx-auto ui-flex ui-max-w-7xl">
                  {/* Left Tiles */}
                  <div className="ui-flex-grow-2 ui-gap-6 ui-flex ui-flex-col ui-max-w-[700px] ui-mx-auto">
                    <Overview account={account} />
                    {account && (
                      <AccountMigration
                        currentCodeId={account.codeId}
                        updateContractCodeID={updateAbstractAccountCodeId}
                      />
                    )}
                    <AccountInfo />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  );
}
