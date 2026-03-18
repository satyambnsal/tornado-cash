/**
 * Ethereum Wallet Account Creation Hook
 *
 * Creates MetaMask-based smart accounts via the AA API v2 using xion.js.
 */

import { createEthWalletAccount } from "@burnt-labs/abstraxion-core";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  getEthWalletAddress,
  signWithEthWallet,
  WalletAccountError,
  getErrorMessageForUI,
} from "../utils";
import {
  ABSTRAXION_API_URL,
  FEE_GRANTER_ADDRESS,
  DEFAULT_ACCOUNT_CONTRACT_CODE_ID,
  XION_RPC_URL,
  CHAIN_ID,
} from "../config";
import { getConnectionAdapter } from "../connectionAdapters";
import { CONNECTION_METHOD } from "../auth/AuthStateManager";

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
 * Creates a MetaMask-based smart account using xion.js
 * Uses dashboard config for API URL, fee granter, etc.
 */
export async function createEthWalletSmartAccount(): Promise<CreateWalletAccountResult> {
  try {
    // Get the connection adapter
    const adapter = getConnectionAdapter(
      AUTHENTICATOR_TYPE.EthWallet,
      CONNECTION_METHOD.Metamask,
    );

    // Enable the connection (may trigger wallet popup)
    await adapter.enable(CHAIN_ID);

    // 1. Get Ethereum address using utility function
    const ethAddress = await getEthWalletAddress();

    // 2. Fetch contract checksum
    const checksum = await getContractChecksum(
      XION_RPC_URL,
      DEFAULT_ACCOUNT_CONTRACT_CODE_ID,
    );

    // 3. Get address prefix from chain ID
    const addressPrefix = getAddressPrefix(CHAIN_ID);

    // 4. Create sign function that signs hex messages
    const signMessageFn = async (hexMessage: string): Promise<string> => {
      // Use utility function to sign with MetaMask
      // signWithEthWallet expects plain message, but we receive hex
      return await signWithEthWallet(hexMessage, ethAddress);
    };

    // 5. Create account via xion.js
    const result = await createEthWalletAccount(
      ABSTRAXION_API_URL,
      ethAddress,
      signMessageFn,
      checksum,
      FEE_GRANTER_ADDRESS,
      addressPrefix,
      XION_RPC_URL,
    );

    return {
      accountAddress: result.account_address,
      codeId: result.code_id,
      transactionHash: result.transaction_hash,
      walletInfo: {
        type: AUTHENTICATOR_TYPE.EthWallet,
        address: ethAddress,
        identifier: ethAddress,
      },
    };
  } catch (error) {
    throw new WalletAccountError(
      "Failed to create MetaMask account",
      getErrorMessageForUI(error),
      error,
    );
  }
}
