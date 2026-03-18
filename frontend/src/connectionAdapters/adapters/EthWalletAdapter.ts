/**
 * EthWalletAdapter - Adapter for Ethereum wallets using EthWallet signatures
 *
 * Supports:
 * - MetaMask (window.ethereum with isMetaMask flag)
 *
 * These wallets use the standard Ethereum provider API (EIP-1193).
 */

import type { OfflineSigner } from "@cosmjs/proto-signing";
import type { StdSignature } from "@cosmjs/amino";
import { AUTHENTICATOR_TYPE, AAEthSigner } from "@burnt-labs/signers";
import type { ConnectionAdapter } from "../types";
import { CONNECTION_METHOD } from "../../auth/AuthStateManager";

/**
 * Keplr-compatible Key interface
 * Used by wallet adapters that need to return key information
 */
export interface Key {
  readonly name: string;
  readonly algo: string;
  readonly pubKey: Uint8Array;
  readonly address: Uint8Array;
  readonly bech32Address: string;
  readonly isNanoLedger: boolean;
  readonly isKeystone: boolean;
}

/**
 * EthWalletAdapter - Adapter for MetaMask wallet
 */
export class EthWalletAdapter implements ConnectionAdapter {
  readonly authenticatorType = AUTHENTICATOR_TYPE.EthWallet;
  readonly connectionMethod = CONNECTION_METHOD.Metamask;
  readonly name = "MetaMask";

  isInstalled(): boolean {
    if (!window.ethereum) {
      return false;
    }

    return !!window.ethereum.isMetaMask;
  }

  /**
   * Get the Ethereum provider
   */
  private getProvider(): NonNullable<Window["ethereum"]> {
    if (!window.ethereum) {
      throw new Error("Ethereum wallet not installed");
    }

    if (!window.ethereum.isMetaMask) {
      throw new Error("MetaMask not detected");
    }

    return window.ethereum;
  }

  async enable(_chainId: string): Promise<void> {
    const provider = this.getProvider();

    // Request account access (EIP-1102)
    await provider.request({
      method: "eth_requestAccounts",
    });
  }

  async getKey(_chainId: string): Promise<Key> {
    const provider = this.getProvider();

    // Get Ethereum accounts
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error(`No accounts found in ${this.name}`);
    }

    const address = accounts[0];

    // Ethereum wallets don't expose public keys directly
    // Return a minimal Key object with address only
    // The pubkey will be recovered from signature during account creation
    return {
      name: this.name,
      algo: "secp256k1", // Ethereum uses secp256k1
      pubKey: new Uint8Array(0), // Not directly accessible
      address: new TextEncoder().encode(address),
      bech32Address: address, // Use Ethereum address as-is
      isNanoLedger: false,
      isKeystone: false,
    };
  }

  async signArbitrary(
    _chainId: string,
    signer: string,
    data: string | Uint8Array,
  ): Promise<StdSignature> {
    const provider = this.getProvider();

    // Convert Uint8Array to string if needed
    const message =
      typeof data === "string" ? data : new TextDecoder().decode(data);

    // Use personal_sign (EIP-191)
    const signature = (await provider.request({
      method: "personal_sign",
      params: [message, signer],
    })) as string;

    if (!signature) {
      throw new Error("Failed to get signature");
    }

    // Return in StdSignature format
    // Ethereum signatures are 65 bytes (r + s + v)
    return {
      pub_key: {
        type: "tendermint/PubKeySecp256k1",
        value: "", // Not used for Ethereum wallets
      },
      signature: signature.replace("0x", ""), // Remove 0x prefix
    };
  }

  getOfflineSigner(_chainId: string): OfflineSigner {
    // Ethereum wallets don't provide CosmJS OfflineSigner
    // This method should not be called for Ethereum wallets
    // Instead, AAEthSigner uses the signing function directly
    throw new Error(
      `${this.name} does not support CosmJS OfflineSigner. Use AAEthSigner instead.`,
    );
  }

  /**
   * Get a signer for signing transactions
   *
   * @param abstractAccount - XION smart account address (xion1...)
   * @param accountAuthenticatorIndex - Index of the authenticator on the account
   * @returns AAEthSigner instance
   */
  getSigner(
    abstractAccount: string,
    accountAuthenticatorIndex: number,
  ): AAEthSigner {
    const provider = this.getProvider();

    // Create signing function for AAEthSigner
    const ethSigningFn = async (msg: string) => {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      return (await provider.request({
        method: "personal_sign",
        params: [msg, accounts[0]],
      })) as string;
    };

    return new AAEthSigner(
      abstractAccount,
      accountAuthenticatorIndex,
      ethSigningFn,
    );
  }
}

/**
 * Factory function for creating MetaMask adapter
 */
export function createMetaMaskAdapter(): EthWalletAdapter {
  return new EthWalletAdapter();
}
