/**
 * ZKEmailAdapter - Adapter for ZK-Email-based authentication (ZKEmail)
 *
 * This adapter wraps ZK-Email-based authentication and signing.
 * Unlike wallet adapters, this doesn't require browser extensions.
 *
 * ZK-Email signing is handled by AAZKEmailSigner, which communicates
 * with a backend ZK-Email service to sign transactions.
 *
 * PURPOSE: This adapter serves primarily for:
 * 1. Wallet detection (isInstalled) - ZK-Email auth is always available
 * 2. Consistency in the adapter pattern across all connection methods
 * 3. Future extensibility if ZK-Email needs wallet-like operations
 *
 * The actual signing is still done by AAZKEmailSigner.
 * This adapter doesn't replace it, but complements the wallet adapter pattern.
 */

import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import type { PartialConnectionAdapter } from "../types";
import { CONNECTION_METHOD } from "../../auth/AuthStateManager";
import { AAZKEmailSigner } from "../../auth/zk-email/zk-email-signer";
import { FEATURE_FLAGS } from "../../config";

/**
 * ZKEmailAdapter - Adapter for ZK-Email authentication
 *
 * Note: This is a PartialConnectionAdapter because ZK-Email authentication doesn't
 * support all traditional wallet operations (no public key exposure, no offline signer, etc.)
 */
export class ZKEmailAdapter implements PartialConnectionAdapter {
  readonly authenticatorType = AUTHENTICATOR_TYPE.ZKEmail;
  readonly connectionMethod = CONNECTION_METHOD.ZKEmail;
  readonly name = "ZK-Email";

  /**
   * Check if ZK-Email auth is available.
   * Unlike wallet adapters, this checks the feature flag since ZK-Email
   * is a service that may be disabled per environment.
   */
  isInstalled(): boolean {
    return FEATURE_FLAGS.zkemail;
  }

  /**
   * Enable is a no-op for ZK-Email auth
   * Authentication is handled by ZK-Email SDK in the UI
   */
  async enable(_chainId: string): Promise<void> {
    if (!this.isInstalled()) {
      throw new Error("ZK-Email is not supported in this browser");
    }
  }

  /**
   * Get a ZK-Email signer for signing transactions.
   *
   * Proofs and publicInputs are generated at sign time (when the user signs a tx):
   * the signer uses ZK-Email utils to send the sign bytes as the command, user
   * confirms via email, then proof is polled and used—same flow as ZK-Email authenticator.
   *
   * @param abstractAccount - XION smart account address (xion1...)
   * @param accountAuthenticatorIndex - Index of the ZK-Email authenticator on the account
   * @param email - User's email from session (set at ZK-Email login); used to request proof at sign time
   * @returns AAZKEmailSigner instance
   */
  getSigner(
    abstractAccount: string,
    accountAuthenticatorIndex: number,
    email: string,
  ): AAZKEmailSigner {
    return new AAZKEmailSigner(
      abstractAccount,
      accountAuthenticatorIndex,
      email,
    );
  }
}

/**
 * Factory function for creating ZK-Email adapter
 */
export function createZKEmailAdapter(): ZKEmailAdapter {
  return new ZKEmailAdapter();
}
