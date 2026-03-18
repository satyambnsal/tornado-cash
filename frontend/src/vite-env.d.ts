/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Stytch Configuration
  readonly VITE_STYTCH_PUBLIC_TOKEN: string;

  // Network Configuration
  readonly VITE_CHAIN_ID: string;
  readonly VITE_NETWORK: string;

  // XION API Configuration
  readonly VITE_ABSTRAXION_API_URL: string;
  readonly VITE_XION_RPC_URL: string;
  readonly VITE_XION_STYTCH_API: string;

  // Gas Configuration
  readonly VITE_GAS_ADJUSTMENT: string;
  readonly VITE_GAS_MARGIN: string;
  readonly VITE_GAS_PRICE: string;

  // Feature Flags
  readonly VITE_OKX_FLAG: string;
  readonly VITE_METAMASK_FLAG: string;
  readonly VITE_PASSKEY_FLAG: string;
  readonly VITE_KEPLR_FLAG: string;
  readonly VITE_TIKTOK_FLAG: string;
  readonly VITE_APPLE_FLAG: string;

  // Indexer Configuration
  readonly VITE_INDEXER_STRATEGY: string;
  readonly VITE_DEFAULT_INDEXER_URL: string;
  readonly VITE_NUMIA_TOKEN: string;
  readonly VITE_NUMIA_URL: string;

  // Fee Granter Configuration
  readonly VITE_FEE_GRANTER_ADDRESS: string;

  // CoinGecko API Configuration
  readonly VITE_COINGECKO_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
