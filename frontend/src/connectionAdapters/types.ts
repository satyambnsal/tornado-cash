/**
 * Connection Adapter Types
 *
 * Defines the common interface for all connection adapters.
 * Each adapter encapsulates connection-specific logic for wallets, auth providers, etc.
 */

import type { AuthenticatorType } from "@burnt-labs/signers";
import type { ConnectionMethod } from "../auth/AuthStateManager";

/**
 * Base ConnectionAdapter interface
 *
 * All connection adapters must implement this interface.
 * Provides a unified API for interacting with different connection methods
 * (browser extension wallets, social auth providers, WebAuthn, etc.).
 *
 * The core method is `getSigner()` which returns the appropriate AA signer
 * for the connection type (AADirectSigner, AAEthSigner, AbstractAccountJWTSigner, etc.)
 */
export interface ConnectionAdapter {
  /**
   * Human-readable name of the connection method (e.g., "Keplr", "MetaMask", "Passkey")
   */
  readonly name: string;

  /**
   * The authenticator type this connection uses
   * E.g., Secp256K1, EthWallet, JWT, Passkey, ZKEmail
   */
  readonly authenticatorType: AuthenticatorType;

  /**
   * The connection method identifier
   * E.g., keplr, okx, metamask, stytch, passkey, zkemail
   */
  readonly connectionMethod: ConnectionMethod;

  /**
   * Check if the connection method is available
   * For wallets: checks if browser extension is installed
   * For auth providers: checks if service is available
   * @returns true if connection method is available, false otherwise
   */
  isInstalled(): boolean;

  /**
   * Enable/initialize the connection for a specific chain
   * For browser extension wallets, this may trigger a connection popup
   * For auth providers, this may verify service availability
   *
   * @param chainId - The chain ID to enable
   * @throws Error if connection is not available or user rejects
   */
  enable(chainId: string): Promise<void>;
}

/**
 * Adapter for authentication methods that may not require all wallet operations
 *
 * Currently identical to ConnectionAdapter but kept as separate type for semantic clarity.
 * Indicates auth methods that aren't traditional browser extension wallets (JWT, Passkey, etc.)
 */
export type PartialConnectionAdapter = ConnectionAdapter;
