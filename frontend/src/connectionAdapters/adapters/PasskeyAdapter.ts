/**
 * PasskeyAdapter - Adapter for WebAuthn/Passkey authentication
 *
 * This adapter wraps WebAuthn (Passkey) authentication.
 * Uses browser's native WebAuthn API for biometric/hardware key signing.
 *
 * Passkey signing is handled by AAPasskeySigner, which uses the
 * @github/webauthn-json library to interact with WebAuthn.
 *
 * PURPOSE: This adapter serves primarily for:
 * 1. WebAuthn capability detection (isInstalled/enable)
 * 2. Consistency in the adapter pattern across all connection methods
 * 3. Future extensibility if Passkey needs wallet-like operations
 *
 * The actual signing is still done by AAPasskeySigner.
 * This adapter doesn't replace it, but complements the wallet adapter pattern.
 */

import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import type { PartialConnectionAdapter } from "../types";
import { CONNECTION_METHOD } from "../../auth/AuthStateManager";
import { AAPasskeySigner } from "../../auth/passkey/passkey-signer";

/**
 * PasskeyAdapter - Adapter for WebAuthn/Passkey authentication
 *
 * Note: This is a PartialConnectionAdapter because Passkey authentication doesn't
 * support all traditional wallet operations (no public key exposure, no offline signer, etc.)
 */
export class PasskeyAdapter implements PartialConnectionAdapter {
  readonly authenticatorType = AUTHENTICATOR_TYPE.Passkey;
  readonly connectionMethod = CONNECTION_METHOD.Passkey;
  readonly name = "Passkey (WebAuthn)";

  /**
   * Check if WebAuthn is supported in this browser
   */
  isInstalled(): boolean {
    return (
      typeof window !== "undefined" &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable === "function"
    );
  }

  /**
   * Verify that WebAuthn is available and ready
   * Checks for platform authenticator support
   */
  async enable(_chainId: string): Promise<void> {
    if (!this.isInstalled()) {
      throw new Error("WebAuthn is not supported in this browser");
    }

    // Check if user-verifying platform authenticator is available
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    if (!available) {
      throw new Error(
        "No platform authenticator available. Please use a device with biometric authentication or a security key.",
      );
    }
  }

  /**
   * Get a Passkey signer for signing transactions
   *
   * The signer uses WebAuthn to prompt for biometric/hardware key authentication.
   *
   * @param abstractAccount - XION smart account address (xion1...)
   * @param accountAuthenticatorIndex - Index of the Passkey authenticator on the account
   * @returns AAPasskeySigner instance
   */
  getSigner(
    abstractAccount: string,
    accountAuthenticatorIndex: number,
  ): AAPasskeySigner {
    return new AAPasskeySigner(abstractAccount, accountAuthenticatorIndex);
  }
}

/**
 * Factory function for creating Passkey adapter
 */
export function createPasskeyAdapter(): PasskeyAdapter {
  return new PasskeyAdapter();
}
