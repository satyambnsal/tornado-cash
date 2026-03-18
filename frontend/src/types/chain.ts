/**
 * ChainInfo - Keplr chain configuration type
 *
 * Re-exported from @keplr-wallet/types for use throughout the dashboard.
 * This type matches the structure expected by Keplr's experimentalSuggestChain() API
 * and the chain config files from xion-assets repository.
 *
 * Previously we imported the Network type from @delphi-labs/shuttle, but since
 * we're removing that dependency, we now use Keplr's official types directly.
 */

import type {
  ChainInfo,
  AppCurrency,
  FeeCurrency,
  Bech32Config,
  BIP44,
} from "@keplr-wallet/types";

export type { ChainInfo, Bech32Config, BIP44 };
export type ChainCurrency = AppCurrency;
export type ChainFeeCurrency = FeeCurrency;

/**
 * NetworkInfo type for mainnet/testnet configuration
 */
export interface NetworkInfo {
  mainnet: ChainInfo;
  testnet: ChainInfo;
}
