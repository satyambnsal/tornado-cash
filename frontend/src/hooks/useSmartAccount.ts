/**
 * useSmartAccount - Hook for accessing the current XION account
 *
 * This hook has been simplified to use AuthStateManager as the single source of truth.
 * The previous implementation had 3 separate useEffects to sync localStorage with state,
 * which was complex and error-prone.
 *
 * Now:
 * - State comes from useAuthState() which wraps AuthStateManager
 * - No more manual localStorage sync - AuthStateManager handles it
 * - Simplified isConnected logic using a lookup table instead of nested ternaries
 * - Wallet change detection still handled here (MetaMask, OKX, Keplr events)
 */

import { useEffect, useMemo } from "react";
import { useStytchSession } from "@stytch/react";
import { useAuthState, CONNECTION_METHOD } from "../auth/useAuthState";

export const useSmartAccount = () => {
  const { session } = useStytchSession();

  // Use unified auth state - this is now the source of truth
  const {
    connectionMethod,
    account,
    authenticator,
    authenticatorType,
    isConnected: authStateIsConnected,
    updateAccount,
    logout,
  } = useAuthState();

  // Note: Context syncing is handled by AuthContextProvider's subscription
  // to AuthStateManager. We don't need to sync here - that would cause double updates.

  // Update abstract account code ID
  const updateAbstractAccountCodeId = async (codeId: number) => {
    if (account) {
      const newAccount = { ...account, codeId };
      updateAccount(newAccount);
    }
  };

  // --- Wallet Change Detection ---

  // Metamask account change detection
  useEffect(() => {
    const handleAccountsChanged = (accounts: unknown) => {
      // Use unknown + runtime validation since MetaMask event types aren't guaranteed
      if (
        connectionMethod === CONNECTION_METHOD.Metamask &&
        Array.isArray(accounts) &&
        accounts.length > 0
      ) {
        // Account changed - need to reset and re-authenticate
        console.log("[useSmartAccount] MetaMask account changed:", accounts[0]);
        // Clear the current account so user needs to re-login
        logout(window.location.origin);
      }
    };

    window.ethereum?.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum?.off("accountsChanged", handleAccountsChanged);
    };
  }, [connectionMethod, logout]);

  // OKX account change detection
  // When OKX wallet fires a "connect" event, it means the user switched accounts
  // We should log them out so they can re-authenticate with the new account
  useEffect(() => {
    const handleAccountsChanged = async () => {
      if (connectionMethod === CONNECTION_METHOD.OKX) {
        console.log("[useSmartAccount] OKX wallet event detected, logging out");
        await logout(window.location.origin);
      }
    };

    if (window.okxwallet?.keplr) {
      window.okxwallet.keplr.on("connect", handleAccountsChanged);
    }

    return () => {
      if (window.okxwallet?.keplr) {
        window.okxwallet.keplr.off("connect", handleAccountsChanged);
      }
    };
  }, [connectionMethod, logout]);

  // Keplr account change detection
  useEffect(() => {
    const handleAccountsChanged = () => {
      if (connectionMethod === CONNECTION_METHOD.Keplr) {
        console.log(
          "[useSmartAccount] Keplr account changed, clearing account",
        );
        // Clear account so it gets re-fetched with new key
        if (account) {
          updateAccount({ ...account, id: "" });
        }
      }
    };

    window.addEventListener("keplr_keystorechange", handleAccountsChanged);
    return () => {
      window.removeEventListener("keplr_keystorechange", handleAccountsChanged);
    };
  }, [connectionMethod, account, updateAccount]);

  // --- Compute isConnected ---
  // Simplified from nested ternary to a clear lookup
  const isConnected = useMemo(() => {
    // If AuthStateManager says we're connected with an account, we're connected
    if (authStateIsConnected) {
      return true;
    }

    // Fallback checks during the connecting phase (before account is loaded)
    switch (connectionMethod) {
      case "stytch":
        return !!session;
      case "keplr":
      case "okx":
      case "passkey":
      case "zkemail":
        return !!authenticator;
      case "metamask":
        return window.ethereum?.isConnected?.() ?? false;
      case "none":
      default:
        return false;
    }
  }, [authStateIsConnected, connectionMethod, session, authenticator]);

  return {
    updateAbstractAccountCodeId,
    data: account,
    connectionMethod,
    loginAuthenticator: authenticator,
    loginAuthenticatorType: authenticatorType,
    isConnected,
  };
};
