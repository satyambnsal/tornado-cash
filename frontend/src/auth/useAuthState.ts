/**
 * useAuthState - React hook for accessing and managing auth state
 *
 * This is the PRIMARY way React components should interact with auth state.
 * It wraps AuthStateManager and provides reactive updates using useSyncExternalStore.
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, account, logout } = useAuthState();
 *
 *   if (!isConnected) {
 *     return <LoginButton />;
 *   }
 *
 *   return <div>Welcome, {account?.id}</div>;
 * }
 * ```
 */

import { useSyncExternalStore, useCallback } from "react";
import {
  AuthStateManager,
  ConnectionMethod,
  CONNECTION_METHOD,
  type StytchLikeClient,
} from "./AuthStateManager";
import { SelectedSmartAccount } from "../types/wallet-account-types";
import type { AuthenticatorType } from "@burnt-labs/signers";

// Re-export for convenience
export { type ConnectionMethod, CONNECTION_METHOD };

/**
 * React hook for accessing and managing auth state
 */
export function useAuthState() {
  // Use useSyncExternalStore for optimal React 18 compatibility
  // This ensures proper concurrent rendering support
  const state = useSyncExternalStore(
    // Subscribe function
    useCallback((onStoreChange: () => void) => {
      return AuthStateManager.subscribe(() => onStoreChange());
    }, []),
    // Get snapshot function
    () => AuthStateManager.getState(),
    // Get server snapshot (same for client-only app)
    /* v8 ignore next */
    () => AuthStateManager.getState(),
  );

  // --- Action Methods ---

  /**
   * Start login process
   * Call this when user initiates login with a specific method
   * @param authenticatorType - The authenticator type from @burnt-labs/signers
   * @param connectionMethod - The connection method being used
   * @param authenticator - The authenticator string (JWT, pubkey, address, etc.)
   */
  const startLogin = useCallback(
    (
      authenticatorType: AuthenticatorType,
      connectionMethod: ConnectionMethod,
      authenticator: string,
    ) => {
      AuthStateManager.startLogin(
        authenticatorType,
        connectionMethod,
        authenticator,
      );
    },
    [],
  );

  /**
   * Complete login with the fetched account
   * Call this after smart account is retrieved
   */
  const completeLogin = useCallback((account: SelectedSmartAccount) => {
    AuthStateManager.completeLogin(account);
  }, []);

  /**
   * Logout and clear all auth state
   * @param origin - Optional origin for session cleanup
   * @param stytchClient - Optional Stytch client for session revocation
   */
  const logout = useCallback(async (origin?: string, stytchClient?: StytchLikeClient, options?: { notifyParent?: boolean }) => {
    if (options !== undefined) {
      await AuthStateManager.logout(origin, stytchClient, options);
    } else {
      await AuthStateManager.logout(origin, stytchClient);
    }
  }, []);

  /**
   * Set connection method and persist to localStorage
   */
  const setConnectionMethod = useCallback((method: ConnectionMethod) => {
    AuthStateManager.setConnectionMethod(method);
  }, []);

  /**
   * Get current connection method
   */
  const getConnectionMethod = useCallback(() => {
    return AuthStateManager.getConnectionMethod();
  }, []);

  /**
   * Set error message
   */
  const setError = useCallback((error: string) => {
    AuthStateManager.setError(error);
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    AuthStateManager.clearError();
  }, []);

  /**
   * Update account (e.g., after authenticator change)
   */
  const updateAccount = useCallback((account: SelectedSmartAccount) => {
    AuthStateManager.updateAccount(account);
  }, []);

  /**
   * Reset state without clearing storage
   */
  const resetState = useCallback(() => {
    AuthStateManager.resetState();
  }, []);

  return {
    // --- State Properties ---
    /** Current auth status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' */
    status: state.status,
    /** Current connection method */
    connectionMethod: state.connectionMethod,
    /** Current smart account if connected */
    account: state.account,
    /** Current authenticator identifier */
    authenticator: state.authenticator,
    /** Current authenticator type: 'JWT' | 'EthWallet' | 'Secp256K1' | 'Passkey' | 'ZKEmail' | null */
    authenticatorType: state.authenticatorType,
    /** Current error message if any */
    error: state.error,

    // --- Computed Properties ---
    /** True if fully connected with an account */
    isConnected: state.status === "connected" && !!state.account,
    /** True if in connecting state */
    isConnecting: state.status === "connecting",
    /** True if in disconnecting state */
    isDisconnecting: state.status === "disconnecting",
    /** True if disconnected */
    isDisconnected: state.status === "disconnected",
    /** Shortcut to account address */
    address: state.account?.id ?? null,

    // --- Action Methods ---
    startLogin,
    completeLogin,
    logout,
    setConnectionMethod,
    getConnectionMethod,
    setError,
    clearError,
    updateAccount,
    resetState,
  };
}

// Type for the hook return value (useful for prop drilling)
export type UseAuthStateReturn = ReturnType<typeof useAuthState>;
