/**
 * Mainnet configuration
 */

export const mainnetConfig = {
  // Chain
  chainId: "xion-mainnet-1",
  chainRegistryBaseUrl: "https://assets.xion.burnt.com/chain-registry/xion",
  network: "mainnet",

  // USDC denom
  usdcDenom:
    "ibc/F082B65C88E4B6D5EF1DB243CDA1D331D002759E938A0F5CD3FFDC5D53B3E349",

  // URLs
  dashboardUrl: "https://settings.burnt.com",
  stytchProxyUrl: "https://stytch-proxy.burnt.com/v1",
  abstraxionApiUrl: "https://aa-api.mainnet.burnt.com",
  treasuryApiUrl: "https://treasury-api.burnt.com",
  xionApiUrl: "https://api.xion-mainnet-1.burnt.com",
  xionRpcUrl: "https://rpc.xion-mainnet-1.burnt.com",
  zkEmailBackendUrl: "https://zk-api.burnt.com",
  zkEmailReceiverEmailId: "zkauth@zk.burnt.com",

  // Turnstile (Cloudflare invisible CAPTCHA)
  turnstileSiteKey: "0x4AAAAAACUOXqmE31xhK_y8",

  // Indexer
  indexerStrategy: "numia" as const,
  defaultIndexerUrl:
    "https://api.subquery.network/sq/burnt-labs/xion-mainnet-indexer",
  numiaUrl: "https://xion.numia.xyz/v3/",

  // Fee Granter
  feeGranterAddress: "xion12q9q752mta5fvwjj2uevqpuku9y60j33j9rll0",

  // Contract Code IDs
  defaultAccountContractCodeId: "5",

  // Gas
  gasAdjustment: 1.8,
  gasMargin: 5000,

  // External URLs
  explorerUrl: "https://www.mintscan.io/xion",
  stakingUrl: "https://staking.burnt.com",

  // Feature flags (from .env.mainnet)
  featureFlags: {
    okx: true,
    metamask: true,
    passkey: false,
    keplr: true,
    tiktok: false,
    apple: true,
    zkemail: false,
  },
};
