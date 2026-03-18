import type { ChainInfo, NetworkInfo } from "../types/chain";

const XION_ASSETS_BASE = "https://assets.xion.burnt.com/";

/**
 * Fetch Keplr chain configuration from xion-assets repo
 */
async function fetchChainConfig(chainName: string): Promise<ChainInfo> {
  const url = `${XION_ASSETS_BASE}/${chainName}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch chain config for ${chainName}: ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Load all network configurations from xion-assets
 */
export async function loadChainConfig(): Promise<NetworkInfo> {
  const [mainnet, testnet] = await Promise.all([
    fetchChainConfig("keplr/cosmos/xion-mainnet"),
    fetchChainConfig("keplr/cosmos/xion-testnet"),
  ]);

  return { mainnet, testnet };
}
