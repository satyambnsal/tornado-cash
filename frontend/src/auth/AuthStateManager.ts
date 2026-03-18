/**
 * AuthStateManager - Unified authentication state management
 *
 * This singleton class is the SINGLE SOURCE OF TRUTH for all auth state.
 * It consolidates state that was previously scattered across:
 * - React Context (AuthContext)
 * - localStorage (loginAuthenticator, okxXionAddress, okxWalletName)
 * - sessionStorage (xion_session_{origin})
 * - Hook local state (useSmartAccount, useIframeSession)
 *
 * Benefits:
 * - Clear state machine: disconnected → connecting → connected → disconnecting
 * - Single place to understand auth flow
 * - No sync issues between multiple stores
 * - Easy to debug/log all state transitions
 */

import { SelectedSmartAccount } from "../types/wallet-account-types";
import { SessionManager } from "./session";
import type { AuthenticatorType } from "@burnt-labs/signers";
import { DashboardMessageType } from "../messaging/types";

/**
 * ConnectionMethod - Tracks which connection method/UI was used for authentication
 * This is separate from AuthenticatorType which defines the cryptographic signature type
 * Can be wallets (Keplr, MetaMask), social login (Stytch), or embedded methods (Passkey, ZKEmail)
 */
export type ConnectionMethod =
  | "stytch" // Stytch social login (JWT)
  | "keplr" // Keplr wallet (Secp256k1)
  | "okx" // OKX wallet (Secp256k1)
  | "metamask" // MetaMask wallet (EthWallet)
  | "passkey" // WebAuthn/Passkey (Passkey)
  | "zkemail" // ZK-Email authentication (ZKEmail)
  | "apple" // Apple social login
  | "none";

/**
 * ConnectionMethod constants
 * Use these instead of string literals to avoid typos and ensure type safety
 */
export const CONNECTION_METHOD = Object.freeze({
  Stytch: "stytch" as const,
  Keplr: "keplr" as const,
  OKX: "okx" as const,
  Metamask: "metamask" as const,
  Passkey: "passkey" as const,
  ZKEmail: "zkemail" as const,
  Apple: "apple" as const,
  None: "none" as const,
});

// Auth state machine states
export type AuthStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting";

// Full auth state
export interface AuthState {
  status: AuthStatus;
  connectionMethod: ConnectionMethod;
  account: SelectedSmartAccount | undefined;
  authenticator: string | null;
  authenticatorType: AuthenticatorType | null;
  error: string | null;
}

// Listener type for state changes
export type AuthStateListener = (
  state: AuthState,
  prevState: AuthState,
) => void;

// Storage keys - centralized in one place
export const AUTH_STORAGE_KEYS = {
  CONNECTION_METHOD: "connectionMethod",
  AUTHENTICATOR_TYPE: "authenticatorType",
  LOGIN_AUTHENTICATOR: "loginAuthenticator",
} as const;

/**
 * localStorage key for ZK-Email address (used for signing transactions).
 *
 * This is stored in localStorage (not React context) because:
 * 1. It must persist across page refreshes and tab switches
 * 2. The AAZKEmailSigner needs the email to request proofs for signing
 * 3. Without localStorage, users would need to re-authenticate after every refresh
 *
 * Cleared on logout via AuthStateManager.clearZKEmailData().
 */
export const ZK_EMAIL_SESSION_KEY = "zkEmailAddress" as const;

/**
 * Minimal interface for Stytch-like clients used in auth operations.
 * Avoids importing the full Stytch SDK into auth modules.
 */
export interface StytchLikeClient {
  session?: {
    getTokens?: () => Record<string, unknown> | null;
    revoke?: () => Promise<unknown>;
    authenticate?: () => Promise<{ status_code?: number }>;
  };
}

class AuthStateManagerClass {
  private state: AuthState = {
    status: "disconnected",
    connectionMethod: "none",
    account: undefined,
    authenticator: null,
    authenticatorType: null,
    error: null,
  };

  // Cached snapshot for useSyncExternalStore - MUST return same reference if state unchanged
  private stateSnapshot: Readonly<AuthState> = this.state;

  private listeners = new Set<AuthStateListener>();
  private initialized = false;

  /** Origin of the parent SDK window (set from IframeMessageHandler's onConnect callback) */
  private parentOrigin: string | null = null;

  /**
   * Initialize from localStorage on startup
   * Should be called once when the app loads
   */
  initialize(): void {
    if (this.initialized) return;

    const storedConnectionMethod = localStorage.getItem(
      AUTH_STORAGE_KEYS.CONNECTION_METHOD,
    ) as ConnectionMethod | null;

    const storedAuthenticatorType = localStorage.getItem(
      AUTH_STORAGE_KEYS.AUTHENTICATOR_TYPE,
    ) as AuthenticatorType | null;

    const storedAuth = localStorage.getItem(
      AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR,
    );

    if (storedConnectionMethod && storedAuth && storedAuthenticatorType) {
      this.state = {
        ...this.state,
        status: "connecting", // Will become 'connected' once account is loaded
        connectionMethod: storedConnectionMethod,
        authenticator: storedAuth,
        authenticatorType: storedAuthenticatorType,
      };
      // Update snapshot to reflect initialized state
      this.stateSnapshot = { ...this.state };
      console.log("[AuthStateManager] Initialized with stored credentials:", {
        connectionMethod: storedConnectionMethod,
        authenticatorType: storedAuthenticatorType,
        authenticator: storedAuth.substring(0, 20) + "...",
      });
    } else {
      console.log("[AuthStateManager] Initialized in disconnected state");
    }

    this.initialized = true;
  }

  /**
   * Store the parent SDK's origin for scoped postMessage.
   * Called from App.tsx's IframeMessageHandler onConnect callback.
   */
  setParentOrigin(origin: string): void {
    this.parentOrigin = origin;
    console.log("[AuthStateManager] Parent origin set:", origin);
  }

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state (read-only snapshot)
   * IMPORTANT: Returns same reference if state unchanged - required for useSyncExternalStore
   */
  getState(): Readonly<AuthState> {
    return this.stateSnapshot;
  }

  /**
   * Check if fully connected (has account)
   */
  isConnected(): boolean {
    return this.state.status === "connected" && !!this.state.account;
  }

  /**
   * Check if in connecting state
   */
  isConnecting(): boolean {
    return this.state.status === "connecting";
  }

  /**
   * Check if in disconnecting state
   */
  isDisconnecting(): boolean {
    return this.state.status === "disconnecting";
  }

  /**
   * Get address if connected
   */
  getAddress(): string | null {
    return this.state.account?.id ?? null;
  }

  /**
   * Get current authenticator
   */
  getAuthenticator(): string | null {
    return this.state.authenticator;
  }

  /**
   * Get current authenticator type
   */
  getAuthenticatorType(): AuthenticatorType | null {
    return this.state.authenticatorType;
  }

  /**
   * Get connection method
   */
  getConnectionMethod(): ConnectionMethod {
    return this.state.connectionMethod;
  }

  /**
   * Get ZK-Email address from localStorage (for signing transactions).
   * Set at login via setZKEmailData(); cleared on logout.
   */
  getZKEmailData(): string | null {
    try {
      return localStorage.getItem(ZK_EMAIL_SESSION_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Store ZK-Email address in localStorage for use when signing transactions.
   * Call this from LoginScreen after successful ZK-Email login.
   */
  setZKEmailData(email: string): void {
    try {
      localStorage.setItem(ZK_EMAIL_SESSION_KEY, email);
      console.log("[AuthStateManager] ZK-Email address stored");
    } catch (error) {
      console.error(
        "[AuthStateManager] Failed to store ZK-Email address:",
        error,
      );
    }
  }

  /**
   * Clear ZK-Email address from localStorage.
   * Called on logout; can also be used when switching away from ZK-Email.
   */
  clearZKEmailData(): void {
    try {
      localStorage.removeItem(ZK_EMAIL_SESSION_KEY);
      console.log("[AuthStateManager] ZK-Email data cleared");
    } catch (error) {
      console.error("[AuthStateManager] Failed to clear ZK-Email data:", error);
    }
  }

  /**
   * Set connection method and persist to localStorage
   */
  setConnectionMethod(method: ConnectionMethod): void {
    const prevState = { ...this.state };
    this.state = {
      ...this.state,
      connectionMethod: method,
    };
    localStorage.setItem(AUTH_STORAGE_KEYS.CONNECTION_METHOD, method);
    console.log("[AuthStateManager] Connection method updated:", method);
    this.notifyListeners(prevState);
  }

  /**
   * Get current account
   */
  getAccount(): SelectedSmartAccount | undefined {
    return this.state.account;
  }

  // --- State Transitions ---

  /**
   * Start login process
   * Transitions: disconnected → connecting
   */
  startLogin(
    authenticatorType: AuthenticatorType,
    connectionMethod: ConnectionMethod,
    authenticator: string,
  ): void {
    const prevState = { ...this.state };

    this.state = {
      ...this.state,
      status: "connecting",
      connectionMethod,
      authenticator,
      authenticatorType,
      error: null,
    };

    // Persist to localStorage
    localStorage.setItem(AUTH_STORAGE_KEYS.CONNECTION_METHOD, connectionMethod);
    localStorage.setItem(
      AUTH_STORAGE_KEYS.AUTHENTICATOR_TYPE,
      authenticatorType,
    );
    localStorage.setItem(AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR, authenticator);

    console.log("[AuthStateManager] Login started:", {
      connectionMethod,
      authenticatorType,
      authenticator: authenticator.substring(0, 20) + "...",
    });

    this.notifyListeners(prevState);
    this.dispatchStorageEvent(
      AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR,
      authenticator,
    );
  }

  /**
   * Complete login with account
   * Transitions: connecting → connected
   */
  completeLogin(account: SelectedSmartAccount): void {
    const prevState = { ...this.state };

    this.state = {
      ...this.state,
      status: "connected",
      account,
      error: null,
    };

    console.log("[AuthStateManager] Login completed:", {
      address: account.id,
      authenticatorIndex: account.currentAuthenticatorIndex,
    });

    this.notifyListeners(prevState);
  }

  /**
   * Logout - clears all auth state and storage
   * Transitions: any → disconnecting → disconnected
   *
   * @param origin - The window origin for session cleanup
   * @param stytchClient - Stytch client for session revocation
   * @param options.notifyParent - If false, skip sending HARD_DISCONNECT to parent.
   *   Use this for "switch account" flows where the iframe should stay alive.
   *   Defaults to true.
   */
  async logout(origin?: string, stytchClient?: StytchLikeClient, options?: { notifyParent?: boolean }): Promise<void> {
    const prevState = { ...this.state };

    // Transition to disconnecting
    this.state = {
      ...this.state,
      status: "disconnecting",
    };
    this.notifyListeners(prevState);

    console.log("[AuthStateManager] Logout started");

    // Revoke Stytch session if applicable
    if (
      prevState.connectionMethod === CONNECTION_METHOD.Stytch &&
      stytchClient
    ) {
      try {
        const tokens = stytchClient.session?.getTokens?.();
        if (tokens) {
          await stytchClient.session?.revoke?.();
          console.log("[AuthStateManager] Stytch session revoked");
        }
      } catch (error) {
        console.warn(
          "[AuthStateManager] Error revoking Stytch session:",
          error,
        );
      }
    }

    // Clear sessionStorage for origin
    if (origin) {
      SessionManager.clearSession(origin);
      console.log("[AuthStateManager] Session cleared for origin:", origin);
    }

    this.clearZKEmailData();

    // Clear all localStorage auth data
    localStorage.removeItem(AUTH_STORAGE_KEYS.CONNECTION_METHOD);
    localStorage.removeItem(AUTH_STORAGE_KEYS.AUTHENTICATOR_TYPE);
    localStorage.removeItem(AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR);

    // Final state - fully disconnected
    const disconnectingState = { ...this.state };
    this.state = {
      status: "disconnected",
      connectionMethod: CONNECTION_METHOD.None,
      account: undefined,
      authenticator: null,
      authenticatorType: null,
      error: null,
    };

    console.log("[AuthStateManager] Logout completed");

    this.notifyListeners(disconnectingState);
    this.dispatchStorageEvent(AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR, null);

    // Notify parent window (for iframe scenarios).
    // Only sends if parentOrigin was set during CONNECT handshake.
    // Standalone dashboard (no iframe) skips this entirely.
    // Skipped when notifyParent=false (e.g. "use a different account" flow).
    if (this.parentOrigin && options?.notifyParent !== false) {
      try {
        window.parent.postMessage(
          { type: DashboardMessageType.HARD_DISCONNECT },
          this.parentOrigin,
        );
      } catch {
        // Ignore if not in iframe context
      }
    }
  }

  /**
   * Set error state. Empty or whitespace-only string is treated as clear (no log, error set to null).
   */
  setError(error: string): void {
    const trimmed = typeof error === "string" ? error.trim() : "";
    if (!trimmed) {
      this.clearError();
      return;
    }
    const prevState = { ...this.state };
    this.state = { ...this.state, error: trimmed };
    console.error("[AuthStateManager] Error:", trimmed);
    this.notifyListeners(prevState);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    if (this.state.error) {
      const prevState = { ...this.state };
      this.state = { ...this.state, error: null };
      this.notifyListeners(prevState);
    }
  }

  /**
   * Update account (e.g., after authenticator change or account selection)
   */
  updateAccount(account: SelectedSmartAccount): void {
    const prevState = { ...this.state };
    this.state = {
      ...this.state,
      account,
      status: "connected", // Ensure we're in connected state
    };
    console.log("[AuthStateManager] Account updated:", {
      address: account.id,
      authenticatorIndex: account.currentAuthenticatorIndex,
    });
    this.notifyListeners(prevState);
  }

  /**
   * Reset to disconnected state without clearing storage
   * Used when session expires or becomes invalid
   */
  resetState(): void {
    const prevState = { ...this.state };
    this.state = {
      status: "disconnected",
      connectionMethod: CONNECTION_METHOD.None,
      account: undefined,
      authenticator: null,
      authenticatorType: null,
      error: null,
    };
    console.log("[AuthStateManager] State reset");
    this.notifyListeners(prevState);
  }

  // --- Private Helpers ---

  private notifyListeners(prevState: AuthState): void {
    // Create new snapshot - this signals to useSyncExternalStore that state changed
    this.stateSnapshot = { ...this.state };

    this.listeners.forEach((listener) => {
      try {
        listener(this.stateSnapshot, prevState);
      } catch (error) {
        console.error("[AuthStateManager] Listener error:", error);
      }
    });
  }

  private dispatchStorageEvent(key: string, value: string | null): void {
    // Dispatch storage event for cross-window/cross-component sync
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: value,
        storageArea: localStorage,
      }),
    );
  }
}

// Singleton instance - the SINGLE SOURCE OF TRUTH
export const AuthStateManager = new AuthStateManagerClass();
