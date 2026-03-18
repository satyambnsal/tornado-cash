import { mainnetConfig } from "./mainnet";
import { testnetConfig } from "./testnet";
// will add devnetConfig later, use testnetConfig for now
import { testnetConfig as devnetConfig } from "./testnet";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get an environment variable or throw an error if not set.
 * Use this for required secrets that have no default value.
 */
function getEnvOrThrow(key: string, description?: string): string {
  const value = import.meta.env[key];
  if (!value) {
    const desc = description ? ` (${description})` : "";
    throw new Error(`Missing required environment variable: ${key}${desc}`);
  }
  return value;
}

// =============================================================================
// Network Configuration
// =============================================================================
export const TORNADO_CONTRACT_ADDRESS = "xion1hmzfzh806z0cdl2red0lx2n9sp5pse5y72urta75xdt5rrvmj5lszkc8s6"
export const NETWORK = import.meta.env.VITE_NETWORK || "testnet";

// this is a bad idea, but keeping for backwards compatibility
export const isMainnet = (): boolean => {
  return NETWORK === "mainnet";
};

// Select network config based on environment
export const networkConfig =
  NETWORK === "mainnet"
    ? mainnetConfig
    : NETWORK === "devnet"
      ? devnetConfig
      : testnetConfig;

// Re-export network config type
export type NetworkConfig = typeof networkConfig;

// =============================================================================
// Chain Configuration
// =============================================================================

interface FeeToken {
  denom: string;
  fixed_min_gas_price: number;
  low_gas_price: number;
  average_gas_price: number;
  high_gas_price: number;
}

export interface ChainConfig {
  chain_name: string;
  chain_id: string;
  fees: {
    fee_tokens: FeeToken[];
  };
}

// Chain ID (env override for local development)
export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || networkConfig.chainId;

const CHAIN_REGISTRY_BASE_URL =
  import.meta.env.VITE_CHAIN_REGISTRY_BASE_URL ||
  networkConfig.chainRegistryBaseUrl;

export const getAssetEndpoint = () => {
  return `${CHAIN_REGISTRY_BASE_URL}/assetlist.json`;
};

export const getChainRegistryUrl = () => {
  return `${CHAIN_REGISTRY_BASE_URL}/chain.json`;
};

export const getGasPrice = (chainConfig: ChainConfig) => {
  return chainConfig.fees.fee_tokens[0];
};

export const getDefaultGasPrice = (chainConfig: ChainConfig) => {
  const feeToken = chainConfig.fees.fee_tokens[0];
  return feeToken.fixed_min_gas_price || feeToken.average_gas_price;
};

export const COINGECKO_API_URL =
  import.meta.env.VITE_COINGECKO_API_URL ||
  "https://api.coingecko.com/api/v3/simple/price";

export const getRestApiUrl = (chainInfo: { rest: string }) => {
  return chainInfo.rest;
};

export const REST_ENDPOINTS = {
  balances: "/cosmos/bank/v1beta1/balances",
} as const;

// =============================================================================
// External URLs
// =============================================================================

export const getExplorerUrl = () => networkConfig.explorerUrl;
export const getStakingUrl = () => networkConfig.stakingUrl;
export const getExplorerTxUrl = (txHash: string) =>
  `${networkConfig.explorerUrl}/txs/${txHash}`;
export const getExplorerAddressUrl = (address: string) =>
  `${networkConfig.explorerUrl}/account/${address}`;

// =============================================================================
// Asset Configuration
// =============================================================================

export const FEATURED_ASSETS = ["USDC", "XION"] as const;
export const USDC_DENOM = networkConfig.usdcDenom;

// =============================================================================
// API URLs
// =============================================================================

export const XION_API_URL =
  import.meta.env.VITE_XION_API_URL || networkConfig.xionApiUrl;

export const XION_RPC_URL =
  import.meta.env.VITE_XION_RPC_URL || networkConfig.xionRpcUrl;

export const STYTCH_PROXY_URL =
  import.meta.env.VITE_XION_STYTCH_API || networkConfig.stytchProxyUrl;

// AA-API URL - used for account abstraction operations
export const ABSTRAXION_API_URL =
  import.meta.env.VITE_ABSTRAXION_API_URL || networkConfig.abstraxionApiUrl;

// Treasury Worker API URL - used for treasury contract queries
export const TREASURY_API_URL =
  import.meta.env.VITE_TREASURY_API_URL || networkConfig.treasuryApiUrl;

export const ZK_EMAIL_BACKEND_URL =
  import.meta.env.VITE_ZKEMAIL_BACKEND_URL || networkConfig.zkEmailBackendUrl;

export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || networkConfig.turnstileSiteKey;

// Allowed email host for ZK-Email authentication
export const ZK_EMAIL_RECEIVER_EMAIL_ID = import.meta.env.VITE_ZK_EMAIL_RECEIVER_EMAIL_ID || networkConfig.zkEmailReceiverEmailId;

// =============================================================================
// Indexer Configuration
// =============================================================================

export const INDEXER_STRATEGY =
  import.meta.env.VITE_INDEXER_STRATEGY || networkConfig.indexerStrategy;

export const DEFAULT_INDEXER_URL =
  import.meta.env.VITE_DEFAULT_INDEXER_URL || networkConfig.defaultIndexerUrl;

export const NUMIA_URL =
  import.meta.env.VITE_NUMIA_URL || networkConfig.numiaUrl;

// Numia token is required and has no default
export const NUMIA_TOKEN = import.meta.env.VITE_NUMIA_TOKEN || "";

// =============================================================================
// Fee Granter Configuration
// =============================================================================

export const FEE_GRANTER_ADDRESS =
  import.meta.env.VITE_FEE_GRANTER_ADDRESS || networkConfig.feeGranterAddress;

// =============================================================================
// Contract Configuration
// =============================================================================

export const DEFAULT_ACCOUNT_CONTRACT_CODE_ID =
  import.meta.env.VITE_DEFAULT_ACCOUNT_CONTRACT_CODE_ID ||
  networkConfig.defaultAccountContractCodeId;

// =============================================================================
// Gas Configuration
// =============================================================================

export const GAS_ADJUSTMENT = import.meta.env.VITE_GAS_ADJUSTMENT
  ? parseFloat(import.meta.env.VITE_GAS_ADJUSTMENT)
  : networkConfig.gasAdjustment;

export const GAS_MARGIN = import.meta.env.VITE_GAS_MARGIN
  ? parseInt(import.meta.env.VITE_GAS_MARGIN, 10)
  : networkConfig.gasMargin;

// =============================================================================
// Environment Mode
// =============================================================================

/** Check if running in development mode via NODE_ENV/Vite MODE */
export const IS_DEV = import.meta.env.MODE === "development";

// =============================================================================
// Feature Flags
// =============================================================================

// Helper to parse feature flag env vars (explicit true/false, falls back to network default)
const parseFeatureFlag = (
  envValue: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return defaultValue;
};

export const FEATURE_FLAGS = {
  okx: parseFeatureFlag(
    import.meta.env.VITE_OKX_FLAG,
    networkConfig.featureFlags.okx,
  ),
  metamask: parseFeatureFlag(
    import.meta.env.VITE_METAMASK_FLAG,
    networkConfig.featureFlags.metamask,
  ),
  passkey: parseFeatureFlag(
    import.meta.env.VITE_PASSKEY_FLAG,
    networkConfig.featureFlags.passkey,
  ),
  keplr: parseFeatureFlag(
    import.meta.env.VITE_KEPLR_FLAG,
    networkConfig.featureFlags.keplr,
  ),
  tiktok: parseFeatureFlag(
    import.meta.env.VITE_TIKTOK_FLAG,
    networkConfig.featureFlags.tiktok,
  ),
  apple: parseFeatureFlag(
    import.meta.env.VITE_APPLE_FLAG,
    networkConfig.featureFlags.apple,
  ),
  zkemail: parseFeatureFlag(
    import.meta.env.VITE_ZKEMAIL_FLAG,
    networkConfig.featureFlags.zkemail,
  ),
};

// =============================================================================
// Stytch Configuration (secrets - env var only, no defaults)
// =============================================================================

// Required for Stytch SDK initialization
// Lazy-loaded to avoid throwing at module import time (e.g. during tests)
export function getStytchPublicToken(): string {
  return getEnvOrThrow(
    "VITE_STYTCH_PUBLIC_TOKEN",
    "Stytch public token for SDK initialization",
  );
}

// =============================================================================
// External OAuth Configuration
// =============================================================================

export const OAUTH_CALLBACK_URL =
  import.meta.env.VITE_OAUTH_CALLBACK_URL ||
  `${networkConfig.dashboardUrl}/oauth/callback`;

// =============================================================================
// Tornado Cash Configuration
// =============================================================================

export const TORNADO_PROOF_SERVER_URL =
  import.meta.env.VITE_PROOF_SERVER_URL || "http://3.213.0.115:3016";



export const TORNADO_DENOMINATION =
  import.meta.env.VITE_DENOMINATION || "100000"; // 0.1 XION

export const TORNADO_MERKLE_TREE_LEVELS =
  import.meta.env.VITE_MERKLE_TREE_LEVELS
    ? parseInt(import.meta.env.VITE_MERKLE_TREE_LEVELS, 10)
    : 10;

// =============================================================================
// Treasury Strategy Configuration
// =============================================================================
