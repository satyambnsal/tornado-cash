/**
 * ConnectionAdapterFactory - Factory for creating connection adapters
 *
 * Provides a centralized way to create connection adapters based on
 * AuthenticatorType and ConnectionMethod.
 *
 * This factory eliminates the need for switch statements throughout the codebase,
 * making it easier to add new connection methods (wallets, auth providers, etc.)
 */

import type { AuthenticatorType } from "@burnt-labs/signers";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import type { ConnectionMethod } from "../auth/AuthStateManager";
import { CONNECTION_METHOD } from "../auth/AuthStateManager";
import type { ConnectionAdapter, PartialConnectionAdapter } from "./types";
import {
  createKeplrAdapter,
  createOKXAdapter,
} from "./adapters/Secp256k1Adapter";
import { createMetaMaskAdapter } from "./adapters/EthWalletAdapter";
import { createJWTAdapter } from "./adapters/JWTAdapter";
import { createPasskeyAdapter } from "./adapters/PasskeyAdapter";
import { createZKEmailAdapter } from "./adapters/ZKEmailAdapter";

/**
 * Get a connection adapter instance based on authenticator type and connection method
 *
 * @param authenticatorType - The cryptographic signature type (Secp256K1, EthWallet, JWT, etc.)
 * @param connectionMethod - The UI/service used for authentication (keplr, metamask, stytch, etc.)
 * @returns ConnectionAdapter or PartialConnectionAdapter instance
 * @throws Error if the combination is not supported
 */
export function getConnectionAdapter(
  authenticatorType: AuthenticatorType,
  connectionMethod: ConnectionMethod,
): ConnectionAdapter | PartialConnectionAdapter {

  // Handle Secp256k1 wallets (Keplr, OKX)
  if (authenticatorType === AUTHENTICATOR_TYPE.Secp256K1) {
    switch (connectionMethod) {
      case CONNECTION_METHOD.Keplr:
        return createKeplrAdapter();
      case CONNECTION_METHOD.OKX:
        return createOKXAdapter();
      default:
        throw new Error(
          `Unsupported Secp256k1 connection method: ${connectionMethod}`,
        );
    }
  }

  // Handle Ethereum wallets (MetaMask)
  if (authenticatorType === AUTHENTICATOR_TYPE.EthWallet) {
    switch (connectionMethod) {
      case CONNECTION_METHOD.Metamask:
        return createMetaMaskAdapter();
      default:
        throw new Error(
          `Unsupported EthWallet connection method: ${connectionMethod}`,
        );
    }
  }

  // Handle JWT authentication (Stytch)
  if (authenticatorType === AUTHENTICATOR_TYPE.JWT) {
    if (connectionMethod === CONNECTION_METHOD.Stytch) {
      return createJWTAdapter();
    }
    throw new Error(`Unsupported JWT connection method: ${connectionMethod}`);
  }

  // Handle Passkey authentication
  if (authenticatorType === AUTHENTICATOR_TYPE.Passkey) {
    if (connectionMethod === CONNECTION_METHOD.Passkey) {
      return createPasskeyAdapter();
    }
    throw new Error(
      `Unsupported Passkey connection method: ${connectionMethod}`,
    );
  }

  // Handle ZK-Email authentication
  if (authenticatorType === AUTHENTICATOR_TYPE.ZKEmail) {
    if (connectionMethod === CONNECTION_METHOD.ZKEmail) {
      return createZKEmailAdapter();
    }
    throw new Error(
      `Unsupported ZKEmail connection method: ${connectionMethod}`,
    );
  }

  throw new Error(
    `Unsupported authenticator type: ${authenticatorType} with connection method: ${connectionMethod}`,
  );
}

/**
 * Check if a connection method is available/installed
 */
export function isConnectionAvailable(
  authenticatorType: AuthenticatorType,
  connectionMethod: ConnectionMethod,
): boolean {
  try {
    const adapter = getConnectionAdapter(authenticatorType, connectionMethod);
    return adapter.isInstalled();
  } catch {
    return false;
  }
}

/**
 * Get all available (installed) connection adapters
 */
export function getAvailableConnections(): (
  | ConnectionAdapter
  | PartialConnectionAdapter
)[] {
  const connectionConfigs: Array<{
    authenticatorType: AuthenticatorType;
    connectionMethod: ConnectionMethod;
  }> = [
    // Secp256k1 wallets
    {
      authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
      connectionMethod: CONNECTION_METHOD.Keplr,
    },
    {
      authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
      connectionMethod: CONNECTION_METHOD.OKX,
    },
    // Ethereum wallets
    {
      authenticatorType: AUTHENTICATOR_TYPE.EthWallet,
      connectionMethod: CONNECTION_METHOD.Metamask,
    },
    // Embedded authentication methods (always available)
    {
      authenticatorType: AUTHENTICATOR_TYPE.JWT,
      connectionMethod: CONNECTION_METHOD.Stytch,
    },
    {
      authenticatorType: AUTHENTICATOR_TYPE.Passkey,
      connectionMethod: CONNECTION_METHOD.Passkey,
    },
    {
      authenticatorType: AUTHENTICATOR_TYPE.ZKEmail,
      connectionMethod: CONNECTION_METHOD.ZKEmail,
    },
  ];

  return connectionConfigs
    .map(({ authenticatorType, connectionMethod }) => {
      try {
        const adapter = getConnectionAdapter(
          authenticatorType,
          connectionMethod,
        );
        return adapter.isInstalled() ? adapter : null;
      } catch {
        return null;
      }
    })
    .filter(
      (adapter): adapter is ConnectionAdapter | PartialConnectionAdapter =>
        adapter !== null,
    );
}
