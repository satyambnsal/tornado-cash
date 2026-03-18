/**
 * JWT Account Creation Hook
 *
 * Creates or retrieves JWT-based smart accounts via the AA API v2.
 * Uses Stytch session JWT to create an account with JWT authenticator type.
 */

import { decodeJwt } from "jose";
import { createJWTAccountV2 } from "@burnt-labs/abstraxion-core";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { ABSTRAXION_API_URL } from "../config";
import type { Authenticator } from "@burnt-labs/account-management";
import type { SelectedSmartAccount } from "../types/wallet-account-types";

interface CreateJwtAccountParams {
  sessionJwt: string;
  sessionToken: string;
}

/**
 * Creates or retrieves a JWT-based smart account via the AA API v2.
 *
 * This function:
 * 1. Calls the AA API v2 create endpoint
 * 2. The API handles both new account creation and existing account lookup
 * 3. Returns the account details including address and codeId
 *
 * @param params - Session JWT and token
 * @returns The created/retrieved smart account ready for use
 */
export async function createJwtAccount(
  params: CreateJwtAccountParams,
): Promise<SelectedSmartAccount> {
  const { sessionJwt, sessionToken } = params;

  // Call the SDK function which handles retry logic and error parsing
  // Note: API accepts both session_jwt and session_token, using one for authentication
  const result = await createJWTAccountV2(ABSTRAXION_API_URL, {
    session_jwt: sessionJwt,
    session_token: sessionToken,
  });

  // Determine if this was a new account creation or existing account retrieval
  // Real tx hashes are 64 hex chars, while addressHash is base64-encoded address
  const isNewAccount = /^[A-Fa-f0-9]{64}$/.test(result.transaction_hash);
  if (isNewAccount) {
    console.log(
      "[useCreateJwtAccount] Transaction hash:",
      result.transaction_hash,
    );
  }

  // Extract authenticator from JWT
  const { aud, sub } = decodeJwt(sessionJwt);
  if (!aud || !sub) {
    throw new Error("Invalid JWT: missing aud or sub claims");
  }
  const audience = Array.isArray(aud) ? aud[0] : aud;
  const authenticator = `${audience}.${sub}`;

  // Construct the SelectedSmartAccount object
  const authenticatorData: Authenticator = {
    id: `${result.account_address}-0`,
    type: AUTHENTICATOR_TYPE.JWT,
    authenticator,
    authenticatorIndex: 0,
  };

  return {
    id: result.account_address,
    codeId: result.code_id,
    authenticators: [authenticatorData],
    currentAuthenticatorIndex: 0,
  };
}
