/**
 * Connection Adapters - Unified interface for all connection methods
 *
 * Provides a consistent API for interacting with different connection methods
 * (wallets, social auth, WebAuthn, etc.)
 */

// Export types
export type { ConnectionAdapter, PartialConnectionAdapter } from "./types";

// Export individual adapters
export {
  Secp256k1Adapter,
  createKeplrAdapter,
  createOKXAdapter,
} from "./adapters/Secp256k1Adapter";
export {
  EthWalletAdapter,
  createMetaMaskAdapter,
} from "./adapters/EthWalletAdapter";
export { JWTAdapter, createJWTAdapter } from "./adapters/JWTAdapter";
export {
  PasskeyAdapter,
  createPasskeyAdapter,
} from "./adapters/PasskeyAdapter";

// Export factory functions
export {
  getConnectionAdapter,
  isConnectionAvailable,
  getAvailableConnections,
} from "./ConnectionAdapterFactory";

// Re-export constants for convenience
export { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
export { CONNECTION_METHOD } from "../auth/AuthStateManager";
