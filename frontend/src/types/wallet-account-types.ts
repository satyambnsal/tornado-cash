/**
 * Types for wallet-based smart account creation
 * Uses xion.js AccountType (lowercase) for consistency with API
 */

import type { AccountType, CreateAccountResponseV2 } from "@burnt-labs/signers";
import type { SmartAccountWithCodeId } from "@burnt-labs/account-management";

// Align with xion.js AccountType (lowercase: "ethwallet", "secp256k1")
export type WalletType = Extract<AccountType, "ethwallet" | "secp256k1">;

// Map CreateAccountResponseV2 from xion.js
export type CreateWalletAccountResponse = CreateAccountResponseV2;

// Dashboard-specific types (UI state)
export interface WalletConnectionInfo {
  type: WalletType;
  address?: string; // Wallet address (for display)
  pubkey?: string; // Public key hex
  identifier: string; // What gets stored as authenticator
}

/**
 * Smart account with selected authenticator index
 * Extends SmartAccountWithCodeId from xion.js with dashboard-specific state
 *
 * Note: `id` is re-declared explicitly here because TypeScript's language server
 * sometimes fails to resolve it through the Omit<SmartAccount, "codeId"> chain
 * in the published package types. The `tsc` compiler resolves it correctly; this
 * declaration is a type-only clarification with no runtime effect.
 */
export interface SelectedSmartAccount extends SmartAccountWithCodeId {
  /** The bech32 meta-account address on XION (e.g. "xion1...") */
  id: string;
  currentAuthenticatorIndex: number;
}
