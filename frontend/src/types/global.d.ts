/**
 * Global type declarations for wallet browser extensions
 *
 * Augments the Window interface with wallet extension APIs.
 * These are injected by browser wallet extensions and available globally.
 */

import type { Keplr } from "@keplr-wallet/types";
import type { MetaMaskInpageProvider } from "@metamask/providers";

// OKX Wallet interface (Keplr-compatible)
interface OkxKeplr extends Keplr {
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
}

interface OkxWallet {
  keplr: OkxKeplr;
}

declare global {
  interface Window {
    keplr?: Keplr;
    ethereum?: MetaMaskInpageProvider;
    okxwallet?: OkxWallet;
  }
}

export {};
