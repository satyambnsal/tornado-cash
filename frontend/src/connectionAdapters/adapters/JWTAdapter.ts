/**
 * JWTAdapter - Adapter for JWT-based authentication (Stytch)
 *
 * This adapter wraps Stytch social login and JWT-based signing.
 * Unlike wallet adapters, this doesn't require browser extensions.
 *
 * JWT signing is handled by AbstractAccountJWTSigner, which communicates
 * with a backend JWT service to sign transactions.
 *
 * PURPOSE: This adapter serves primarily for:
 * 1. Wallet detection (isInstalled) - JWT auth is always available
 * 2. Consistency in the adapter pattern across all connection methods
 * 3. Future extensibility if JWT needs wallet-like operations
 *
 * The actual signing is still done by AbstractAccountJWTSigner.
 * This adapter doesn't replace it, but complements the wallet adapter pattern.
 */

import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import type { PartialConnectionAdapter } from "../types";
import { CONNECTION_METHOD } from "../../auth/AuthStateManager";
import { AbstractAccountJWTSigner } from "../../auth/jwt/jwt-signer";

/**
 * JWTAdapter - Adapter for Stytch JWT authentication
 *
 * Note: This is a PartialConnectionAdapter because JWT authentication doesn't
 * support all traditional wallet operations (no public key exposure, no offline signer, etc.)
 */
export class JWTAdapter implements PartialConnectionAdapter {
  readonly authenticatorType = AUTHENTICATOR_TYPE.JWT;
  readonly connectionMethod = CONNECTION_METHOD.Stytch;
  readonly name = "Stytch (Social Login)";

  /**
   * JWT auth is always "installed" - it's a service, not a wallet
   */
  isInstalled(): boolean {
    return true;
  }

  /**
   * Enable is a no-op for JWT auth
   * Authentication is handled by Stytch SDK in the UI
   */
  async enable(_chainId: string): Promise<void> {
    // No-op - Stytch session is managed externally
  }

  /**
   * Get a JWT signer for signing transactions
   *
   * The signer communicates with the JWT service to sign transactions.
   *
   * @param abstractAccount - XION smart account address (xion1...)
   * @param accountAuthenticatorIndex - Index of the JWT authenticator on the account
   * @param sessionToken - Session token from Stytch SDK
   * @param apiUrl - JWT authentication service URL (e.g., STYTCH_PROXY_URL)
   * @returns AbstractAccountJWTSigner instance
   */
  getSigner(
    abstractAccount: string,
    accountAuthenticatorIndex: number,
    sessionToken: string,
    apiUrl: string,
  ): AbstractAccountJWTSigner {
    return new AbstractAccountJWTSigner(
      abstractAccount,
      accountAuthenticatorIndex,
      sessionToken,
      apiUrl,
    );
  }
}

/**
 * Factory function for creating JWT adapter
 */
export function createJWTAdapter(): JWTAdapter {
  return new JWTAdapter();
}
