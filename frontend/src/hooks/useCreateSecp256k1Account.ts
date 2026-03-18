/**
 * Secp256k1 Wallet Account Creation Hook
 *
 * Creates Cosmos wallet-based smart accounts (Keplr/OKX) via the AA API v2 using xion.js.
 */

import { createSecp256k1Account } from "@burnt-labs/abstraxion-core";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  getSecp256k1Pubkey,
  signWithSecp256k1Wallet,
  WalletAccountError,
  getErrorMessageForUI,
} from "../utils";
import {
  ABSTRAXION_API_URL,
  FEE_GRANTER_ADDRESS,
  DEFAULT_ACCOUNT_CONTRACT_CODE_ID,
  XION_RPC_URL,
} from "../config";
import { getConnectionAdapter } from "../connectionAdapters";
import {
  type ConnectionMethod,
  CONNECTION_METHOD,
} from "../auth/AuthStateManager";

export interface WalletConnectionInfo {
  type: "EthWallet" | "Secp256K1";
  address: string;
  pubkey?: string;
  identifier: string;
}

export interface CreateWalletAccountResult {
  accountAddress: string;
  codeId: number;
  transactionHash: string;
  walletInfo: WalletConnectionInfo;
}

/**
 * Fetches contract checksum for the default smart account code ID
 */
async function getContractChecksum(
  rpcUrl: string,
  codeId: string,
): Promise<string> {
  try {
    const client = await CosmWasmClient.connect(rpcUrl);
    const codeDetails = await client.getCodeDetails(parseInt(codeId, 10));

    if (!codeDetails?.checksum) {
      throw new Error("Failed to get contract checksum");
    }

    return codeDetails.checksum;
  } catch (error) {
    throw new WalletAccountError(
      "Failed to fetch contract checksum",
      "Could not retrieve smart account contract details. Please try again.",
      error,
    );
  }
}

/**
 * Extracts address prefix from chain ID (e.g., "xion-testnet-2" -> "xion")
 */
function getAddressPrefix(chainId: string): string {
  const prefix = chainId.split("-")[0];
  if (!prefix) {
    throw new Error(`Invalid chain ID: ${chainId}`);
  }
  return prefix;
}

/**
 * Creates a Cosmos wallet-based smart account (Keplr/OKX) using xion.js
 * Uses dashboard config for API URL, fee granter, etc.
 */
export async function createSecp256k1SmartAccount(
  chainId: string,
  connectionMethod: ConnectionMethod,
): Promise<CreateWalletAccountResult> {
  try {
    // Get the connection adapter
    const adapter = getConnectionAdapter(
      AUTHENTICATOR_TYPE.Secp256K1,
      connectionMethod,
    );

    // Enable the connection (may trigger wallet popup)
    await adapter.enable(chainId);

    // Map ConnectionMethod to wallet name for utility functions
    const walletName: "keplr" | "okx" =
      connectionMethod === CONNECTION_METHOD.OKX ? "okx" : "keplr";

    // 1. Get public key using utility function
    const {
      pubkeyBase64,
      pubkeyHex,
      address: walletAddress,
    } = await getSecp256k1Pubkey(chainId, walletName);

    // 2. Fetch contract checksum
    const checksum = await getContractChecksum(
      XION_RPC_URL,
      DEFAULT_ACCOUNT_CONTRACT_CODE_ID,
    );

    // 3. Get address prefix from chain ID
    const addressPrefix = getAddressPrefix(chainId);

    // 4. Create sign function - MUST use signArbitrary for account creation
    // The backend verifySecp256k1Signature supports ADR-036 wrapped signatures from Keplr
    const signMessageFn = async (hexMessage: string): Promise<string> => {
      // createSecp256k1Account passes hex-encoded messages (with 0x prefix)
      // Convert hex to UTF-8 string for signArbitrary
      const hexWithoutPrefix = hexMessage.startsWith("0x")
        ? hexMessage.slice(2)
        : hexMessage;

      const message = Buffer.from(hexWithoutPrefix, "hex").toString("utf8");

      // Use utility function to sign with the wallet
      // This handles ADR-036 wrapping and returns base64 signature
      // createSecp256k1Account will format it to hex internally
      const hexSignature = await signWithSecp256k1Wallet(
        message,
        chainId,
        walletAddress,
        walletName,
      );

      // signWithSecp256k1Wallet returns hex, but createSecp256k1Account expects base64
      // Convert hex back to base64
      const signatureBytes = Buffer.from(hexSignature, "hex");
      return signatureBytes.toString("base64");
    };

    // 5. Create account via xion.js
    const result = await createSecp256k1Account(
      ABSTRAXION_API_URL,
      pubkeyBase64,
      signMessageFn,
      checksum,
      FEE_GRANTER_ADDRESS,
      addressPrefix,
      XION_RPC_URL,
    );

    console.log(
      "[createSecp256k1SmartAccount] Transaction hash:",
      result.transaction_hash,
    );

    return {
      accountAddress: result.account_address,
      codeId: result.code_id,
      transactionHash: result.transaction_hash,
      walletInfo: {
        type: AUTHENTICATOR_TYPE.Secp256K1,
        address: walletAddress,
        pubkey: pubkeyHex,
        identifier: pubkeyBase64, // Use base64 pubkey for indexer queries
      },
    };
  } catch (error) {
    // Log the full error for debugging
    console.error("[createSecp256k1SmartAccount] Full error details:", error);
    if (error instanceof Error) {
      console.error(
        "[createSecp256k1SmartAccount] Error message:",
        error.message,
      );
      console.error("[createSecp256k1SmartAccount] Error stack:", error.stack);
    }

    throw new WalletAccountError(
      "Failed to create Cosmos wallet account",
      getErrorMessageForUI(error),
      error,
    );
  }
}
