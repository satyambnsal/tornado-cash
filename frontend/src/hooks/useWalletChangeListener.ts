import { useEffect, useRef } from "react";
import { useAuthState, CONNECTION_METHOD } from "../auth/useAuthState";
import { AuthStateManager } from "../auth/AuthStateManager";
import { CHAIN_ID } from "../config";
import { getHumanReadablePubkey } from "../utils";

/**
 * Hook to listen for wallet account changes (e.g., user switches accounts in Keplr or MetaMask)
 *
 * Handles:
 * - Keplr: keplr_keystorechange event
 * - OKX: same as Keplr (uses keplr API)
 * - MetaMask: accountsChanged event
 *
 * When a wallet/account change is detected:
 * - Logs the user out cleanly
 * - Returns them to the login screen
 * - They can then reconnect with the new wallet/account if desired
 */
export function useWalletChangeListener() {
  const { connectionMethod, isConnected } = useAuthState();
  const previousAuthenticator = useRef<string | null>(null);

  useEffect(() => {
    // Reset previousAuthenticator when user disconnects
    // This ensures clean state when logging out
    if (!isConnected) {
      previousAuthenticator.current = null;
      return;
    }

    // Initialize/reset previousAuthenticator for the current connection method
    // This runs on mount and whenever connectionMethod changes
    // Ensures we always start with the current authenticator for the active wallet
    const currentAuth = AuthStateManager.getState().authenticator;
    previousAuthenticator.current = currentAuth;

    // Handle Keplr/OKX wallet changes
    if (
      connectionMethod === CONNECTION_METHOD.Keplr ||
      connectionMethod === CONNECTION_METHOD.OKX
    ) {
      const handleKeystoreChange = async () => {
        console.log("[useWalletChangeListener] Keplr keystore changed");

        try {
          const wallet =
            connectionMethod === CONNECTION_METHOD.Keplr
              ? window.keplr
              : window.okxwallet?.keplr;

          if (!wallet) {
            console.warn("[useWalletChangeListener] Wallet not found");
            return;
          }

          // Get the chain ID from config
          const chainId = CHAIN_ID;
          if (!chainId) {
            console.error(
              "[useWalletChangeListener] No Chain ID is configured",
            );
            return;
          }

          // Get the new account
          const key = await wallet.getKey(chainId);
          const newAuthenticator = getHumanReadablePubkey(key.pubKey);

          console.log(
            "[useWalletChangeListener] New authenticator:",
            newAuthenticator,
          );
          console.log(
            "[useWalletChangeListener] Previous authenticator:",
            previousAuthenticator.current,
          );

          // Only logout if authenticator actually changed
          if (newAuthenticator !== previousAuthenticator.current) {
            console.log(
              "[useWalletChangeListener] Authenticator changed - logging out",
            );

            // Log out cleanly - user can reconnect with new wallet if desired
            AuthStateManager.logout();
          }
        } catch (error) {
          console.error(
            "[useWalletChangeListener] Error handling keystore change:",
            error,
          );
        }
      };

      // Listen for keystore changes
      window.addEventListener("keplr_keystorechange", handleKeystoreChange);

      return () => {
        window.removeEventListener(
          "keplr_keystorechange",
          handleKeystoreChange,
        );
      };
    }

    // Handle MetaMask wallet changes
    if (connectionMethod === CONNECTION_METHOD.Metamask) {
      const handleAccountsChanged = async (accounts: unknown) => {
        console.log("[useWalletChangeListener] MetaMask accounts changed");

        // Use unknown + validation since MetaMask event types aren't guaranteed/accessible
        const accountArray = accounts as string[];

        if (!accountArray || accountArray.length === 0) {
          console.log(
            "[useWalletChangeListener] MetaMask disconnected - logging out",
          );
          AuthStateManager.logout();
          return;
        }

        const newAccount = accountArray[0];
        console.log(
          "[useWalletChangeListener] New MetaMask account:",
          newAccount,
        );
        console.log(
          "[useWalletChangeListener] Previous account:",
          previousAuthenticator.current,
        );

        // Only logout if account actually changed
        if (newAccount !== previousAuthenticator.current) {
          console.log(
            "[useWalletChangeListener] Account changed - logging out",
          );

          // Log out cleanly - user can reconnect with new account if desired
          AuthStateManager.logout();
        }
      };

      // Listen for account changes
      if (window.ethereum) {
        window.ethereum.on("accountsChanged", handleAccountsChanged);

        return () => {
          window.ethereum?.removeListener?.(
            "accountsChanged",
            handleAccountsChanged,
          );
        };
      }
    }
  }, [connectionMethod, isConnected]);
}
