/// <reference types="vite/client" />
import type { Window as KeplrWindow } from "@keplr-wallet/types";
import type { MetaMaskInpageProvider } from "@metamask/providers";
import type EventEmitter from "node:events";

declare global {
  interface Window extends KeplrWindow {
    ethereum?: MetaMaskInpageProvider;
    okxwallet?: {
      keplr: KeplrWindow["keplr"] & EventEmitter;
    };
  }
}
