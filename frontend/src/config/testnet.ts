/**
 * Testnet configuration
 */

export const testnetConfig = {
  // Chain
  chainId: "xion-testnet-2",
  chainRegistryBaseUrl:
    "https://assets.xion.burnt.com/chain-registry/testnets/xiontestnet2",
  network: "testnet-2",

  // USDC denom
  usdcDenom:
    "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4",

  // URLs
  dashboardUrl: "https://settings.testnet.burnt.com",
  stytchProxyUrl: "https://stytch.testnet.burnt.com/v1",
  abstraxionApiUrl: "https://aa-api.testnet.burnt.com",
  treasuryApiUrl: "https://treasury-api.testnet.burnt.com",
  xionApiUrl: "https://api.xion-testnet-2.burnt.com",
  xionRpcUrl: "https://rpc.xion-testnet-2.burnt.com",
  zkEmailBackendUrl: "https://zk-api.testnet.burnt.com",
  zkEmailReceiverEmailId: "zkauth+testnet@zk.burnt.com",

  // Turnstile (Cloudflare invisible CAPTCHA)
  turnstileSiteKey: "0x4AAAAAACUOXqmE31xhK_y8",

  // Indexer
  indexerStrategy: "numia" as const,
  defaultIndexerUrl:
    "https://api.subquery.network/sq/burnt-labs/xion-testnet-2-indexer",
  numiaUrl: "https://xion-testnet-2.numia.xyz/v3/",

  // Fee Granter
  feeGranterAddress: "xion1xrqz2wpt4rw8rtdvrc4n4yn5h54jm0nn4evn2x",

  // Contract Code IDs
  defaultAccountContractCodeId: "1880",

  // Gas
  gasAdjustment: 1.8,
  gasMargin: 5000,

  // External URLs
  explorerUrl: "https://www.mintscan.io/xion-testnet",
  stakingUrl: "https://staking.testnet.burnt.com",

  // Feature flags (from .env.testnet)
  featureFlags: {
    okx: true,
    metamask: true,
    passkey: true,
    keplr: true,
    tiktok: false,
    apple: true,
    zkemail: true,
  },
};
