/**
 * Secp256k1Adapter - Adapter for Cosmos wallets using Secp256k1 signatures
 *
 * Supports:
 * - Keplr wallet (window.keplr)
 * - OKX wallet (window.okxwallet.keplr)
 *
 * These wallets all use the Keplr API interface, but with different access paths.
 */

import type { OfflineSigner } from "@cosmjs/proto-signing";
import type { StdSignature } from "@cosmjs/amino";
import { AUTHENTICATOR_TYPE, AADirectSigner } from "@burnt-labs/signers";
import type { ConnectionAdapter } from "../types";
import {
  CONNECTION_METHOD,
  type ConnectionMethod,
} from "../../auth/AuthStateManager";

/**
 * Keplr-compatible Key interface
 * Used by Cosmos wallets (Keplr, OKX)
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
 * Variant of Secp256k1Adapter
 * Determines which window object to access
 */
export type Secp256k1Variant = "keplr" | "okx";

/**
 * Secp256k1Adapter - Unified adapter for Cosmos wallets
 */
export class Secp256k1Adapter implements ConnectionAdapter {
  readonly authenticatorType = AUTHENTICATOR_TYPE.Secp256K1;
  readonly connectionMethod: ConnectionMethod;
  readonly name: string;

  private variant: Secp256k1Variant;

  constructor(variant: Secp256k1Variant) {
    this.variant = variant;

    switch (variant) {
      case "keplr":
        this.name = "Keplr";
        this.connectionMethod = CONNECTION_METHOD.Keplr;
        break;
      case "okx":
        this.name = "OKX Wallet";
        this.connectionMethod = CONNECTION_METHOD.OKX;
        break;
    }
  }

  isInstalled(): boolean {
    switch (this.variant) {
      case "keplr":
        return !!window.keplr;
      case "okx":
        return !!window.okxwallet?.keplr;
    }
  }

  /**
   * Get the wallet provider object
   * Each variant accesses the Keplr-compatible API differently
   */
  private getWallet(): NonNullable<Window["keplr"]> {
    switch (this.variant) {
      case "keplr":
        if (!window.keplr) {
          throw new Error("Keplr wallet not installed");
        }
        return window.keplr;

      case "okx":
        if (!window.okxwallet?.keplr) {
          throw new Error("OKX wallet not installed");
        }
        return window.okxwallet.keplr;
    }
  }

  async enable(chainId: string): Promise<void> {
    const wallet = this.getWallet();

    // OKX requires explicit enable call before other operations
    // Keplr auto-enables on first use, but explicit enable doesn't hurt
    await wallet.enable(chainId);
  }

  async getKey(chainId: string): Promise<Key> {
    const wallet = this.getWallet();
    const key = await wallet.getKey(chainId);

    if (!key || !key.pubKey) {
      throw new Error(`Failed to get key from ${this.name}`);
    }

    return {
      name: key.name,
      algo: key.algo,
      pubKey: key.pubKey,
      address: key.address,
      bech32Address: key.bech32Address,
      isNanoLedger: key.isNanoLedger,
      isKeystone: key.isKeystone,
    };
  }

  async signArbitrary(
    chainId: string,
    signer: string,
    data: string | Uint8Array,
  ): Promise<StdSignature> {
    const wallet = this.getWallet();

    // OKX requires data to be converted to proper format
    const signData =
      typeof data === "string" ? data : Uint8Array.from(Object.values(data));

    return await wallet.signArbitrary(chainId, signer, signData);
  }

  getOfflineSigner(chainId: string): OfflineSigner {
    const wallet = this.getWallet();
    return wallet.getOfflineSigner(chainId);
  }

  /**
   * Get a signer for signing transactions
   *
   * @param chainId - The chain ID to connect to
   * @param abstractAccount - XION smart account address (xion1...)
   * @param accountAuthenticatorIndex - Index of the authenticator on the account
   * @returns AADirectSigner instance
   */
  async getSigner(
    chainId: string,
    abstractAccount: string,
    accountAuthenticatorIndex: number,
  ): Promise<AADirectSigner> {
    const wallet = this.getWallet();
    const offlineSigner = wallet.getOfflineSigner(chainId);

    return new AADirectSigner(
      offlineSigner,
      abstractAccount,
      accountAuthenticatorIndex,
      (chainId: string, signer: string, data: string | Uint8Array) =>
        this.signArbitrary(chainId, signer, data),
    );
  }
}

/**
 * Factory functions for creating specific wallet adapters
 */
export function createKeplrAdapter(): Secp256k1Adapter {
  return new Secp256k1Adapter("keplr");
}

export function createOKXAdapter(): Secp256k1Adapter {
  return new Secp256k1Adapter("okx");
}
