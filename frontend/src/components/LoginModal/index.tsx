import { useContext, useEffect, useMemo } from "react";
import { AuthContext, AuthContextProps } from "../AuthContext";
import { Dialog, DialogContent } from "../ui";
import { LoginScreen } from "../LoginScreen";
import { useSmartAccount } from "../../hooks";
import { LoginWalletSelector } from "../LoginWalletSelector";
import { LoginErrorDisplay } from "../LoginErrorDisplay";
import { LoginGrantApproval } from "../LoginGrantApproval";
import { LoginConnectConfirm } from "../LoginConnectConfirm";
import { useStytchSession, useStytch } from "@stytch/react";
import { decodeJwt } from "jose";
import { useAuthState } from "../../auth/useAuthState";
import { CONNECTION_METHOD } from "../../auth/useAuthState";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";

import { useQueryParams } from "../../hooks/useQueryParams";

export interface ModalProps {
  onClose: VoidFunction;
  isOpen: boolean;
  /** Called when grant approval completes (inline iframe mode) */
  onApprove?: () => void;
  /** Called when user denies the grant (inline iframe mode) */
  onDeny?: () => void;
}

const MALFORMED_REQUEST_MESSAGE =
  "Application is not setup correctly. For safety and security, we cannot log you in.";

export const LoginModal = ({
  isOpen,
  onClose,
  onApprove,
  onDeny,
}: ModalProps) => {
  const { contracts, stake, bank, grantee, treasury, redirect_uri } =
    useQueryParams([
      "contracts",
      "stake",
      "bank",
      "grantee",
      "treasury",
      "redirect_uri",
    ]);

  const {
    abstraxionError,
    setAbstraxionError,
    showApproval,
    setConnectionMethod,
  } = useContext(AuthContext) as AuthContextProps;

  const { session } = useStytchSession();
  const stytchClient = useStytch();
  const { connectionMethod, startLogin } = useAuthState();
  const { isConnected, data: account } = useSmartAccount();

  // Sync Stytch session to auth state - ensures connectionMethod is 'stytch' when session exists
  useEffect(() => {
    if (session && connectionMethod === CONNECTION_METHOD.None) {
      console.log("[Abstraxion] Detected Stytch session, syncing auth state");
      setConnectionMethod(CONNECTION_METHOD.Stytch);

      // Extract authenticator from session JWT
      try {
        const sessionJwt = stytchClient.session.getTokens()?.session_jwt;
        if (sessionJwt) {
          const { aud, sub } = decodeJwt(sessionJwt);
          if (aud && sub) {
            const audStr = Array.isArray(aud) ? aud[0] : aud;
            const authenticator = `${audStr}.${sub}`;
            startLogin(
              AUTHENTICATOR_TYPE.JWT,
              CONNECTION_METHOD.Stytch,
              authenticator,
            );
          }
        }
      } catch (e) {
        console.warn(
          "[Abstraxion] Failed to extract authenticator from session:",
          e,
        );
      }
    }
  }, [
    session,
    connectionMethod,
    setConnectionMethod,
    startLogin,
    stytchClient,
  ]);

  let bankArray;
  try {
    bankArray = JSON.parse(bank || "");
  } catch {
    // If the bank is not a valid JSON, we split it by comma. Dapp using old version of the library.
    bankArray = [];
  }

  let contractsArray;
  try {
    contractsArray = JSON.parse(contracts || "");
  } catch {
    // If the contracts are not a valid JSON, we split them by comma. Dapp using old version of the library.
    contractsArray = contracts?.split(",") || [];
  }

  // Check for missing redirect_uri in grant flow
  useEffect(() => {
    if (showApproval && !redirect_uri) {
      setAbstraxionError(MALFORMED_REQUEST_MESSAGE);
    }
  }, [showApproval, redirect_uri, setAbstraxionError]);

  useEffect(() => {
    const closeOnEscKey = (e: KeyboardEvent) =>
      e.key === "Escape" ? onClose() : null;
    document.addEventListener("keydown", closeOnEscKey);
    return () => {
      document.removeEventListener("keydown", closeOnEscKey);
    };
  }, [onClose]);

  // Determine if the error is a malformed request error
  const isMalformedRequest = useMemo(() => {
    return abstraxionError?.startsWith(MALFORMED_REQUEST_MESSAGE);
  }, [abstraxionError]);

  const handleReturn = () => {
    window.history.back();
  };

  if (!isOpen) return null;

  // True when at least one grant type is configured (treasury or legacy grants).
  const hasGrantConfig =
    contractsArray.length > 0 || !!stake || bankArray.length > 0 || !!treasury;

  // showApprovalScreen: user is authenticated and a grantee session-key is present.
  const showApprovalScreen = !!account?.id && !!grantee;

  // Determine content key to force remount on major content changes
  const contentKey = useMemo(() => {
    const result = (() => {
      if (abstraxionError) return "error";
      if (showApprovalScreen && hasGrantConfig) return "grant";
      if (showApprovalScreen && !hasGrantConfig) return "connect-confirm";
      if (isConnected) return "wallets";
      return "signin";
    })();

    console.log("[Abstraxion] Content decision:", result, {
      hasError: !!abstraxionError,
      accountId: account?.id,
      showApprovalScreen,
      hasGrantConfig,
      isConnected,
      redirect_uri,
    });

    return result;
  }, [
    abstraxionError,
    showApprovalScreen,
    hasGrantConfig,
    isConnected,
    account?.id,
    redirect_uri,
  ]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent key={contentKey}>
          {abstraxionError ? (
            <LoginErrorDisplay
              description={abstraxionError}
              onClose={onClose}
              title={isMalformedRequest ? "Login Error" : undefined}
              buttonText={isMalformedRequest ? "RETURN" : "CLOSE"}
              onButtonClick={isMalformedRequest ? handleReturn : undefined}
              errorMessage={
                isMalformedRequest ? "redirect_uri is not defined" : undefined
              }
            />
          ) : showApprovalScreen && hasGrantConfig ? (
            <LoginGrantApproval
              bank={bankArray}
              contracts={contractsArray}
              grantee={grantee}
              stake={Boolean(stake)}
              treasury={treasury || undefined}
              onApprove={onApprove}
              onDeny={onDeny}
            />
          ) : showApprovalScreen ? (
            <LoginConnectConfirm
              treasury={treasury || undefined}
              onApprove={onApprove}
              onDeny={onDeny}
            />
          ) : isConnected ? (
            <LoginWalletSelector />
          ) : (
            <LoginScreen />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
