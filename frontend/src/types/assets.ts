import type { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
// types to match https://github.com/cosmos/chain-registry/blob/master/assetlist.schema.json

interface DenomUnit {
  denom: string;
  exponent: number;
  aliases?: string[];
}

interface LogoURIs {
  png?: string;
  svg?: string;
}

interface ImageTheme {
  primary_color_hex?: string;
  background_color_hex?: string;
  circle?: boolean;
  dark_mode?: boolean;
  monochrome?: boolean;
}

interface Image {
  image_sync?: Pointer;
  png?: string;
  svg?: string;
  theme?: ImageTheme;
}

interface Socials {
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  github?: string;
  medium?: string;
  reddit?: string;
}

interface IBC {
  source_channel: string;
  dst_channel: string;
  source_denom: string;
}

interface Pointer {
  chain_name: string;
  base_denom?: string;
}

interface IBCTransitionCounterparty {
  chain_name: string;
  base_denom: string;
  channel_id: string;
}

interface IBCTransitionChain {
  channel_id: string;
  path: string;
}

interface IBCTransition {
  type: "ibc";
  counterparty: IBCTransitionCounterparty;
  chain: IBCTransitionChain;
}

interface IBCCw20TransitionCounterparty extends IBCTransitionCounterparty {
  port: string;
}

interface IBCCw20TransitionChain extends IBCTransitionChain {
  port: string;
}

interface IBCCw20Transition {
  type: "ibc-cw20";
  counterparty: IBCCw20TransitionCounterparty;
  chain: IBCCw20TransitionChain;
}

interface IBCBridgeTransition {
  type: "ibc-bridge";
  counterparty: IBCCw20TransitionCounterparty;
  chain: IBCTransitionChain;
  provider: string;
}

interface NonIBCTransitionCounterparty {
  chain_name: string;
  base_denom: string;
  contract?: string;
}

interface NonIBCTransitionChain {
  contract: string;
}

interface NonIBCTransition {
  type:
    | "bridge"
    | "liquid-stake"
    | "synthetic"
    | "wrapped"
    | "additional-mintage"
    | "test-mintage"
    | "legacy-mintage";
  counterparty: NonIBCTransitionCounterparty;
  chain?: NonIBCTransitionChain;
  provider: string;
}

type Transition =
  | IBCTransition
  | IBCCw20Transition
  | IBCBridgeTransition
  | NonIBCTransition;

export interface Asset {
  deprecated?: boolean;
  description?: string;
  extended_description?: string;
  denom_units: DenomUnit[];
  type_asset:
    | "sdk.coin"
    | "cw20"
    | "erc20"
    | "ics20"
    | "snip20"
    | "snip25"
    | "bitcoin-like"
    | "evm-base"
    | "svm-base"
    | "substrate"
    | "unknown";
  address?: string;
  base: string;
  name: string;
  display: string;
  symbol: string;
  traces?: Transition[];
  ibc?: IBC;
  logo_URIs?: LogoURIs;
  images?: Image[];
  coingecko_id?: string;
  keywords?: string[];
  socials?: Socials;
}

export interface AssetList {
  $schema?: string;
  chain_name: string;
  assets: Asset[];
}

export interface AccountBalance {
  balances: Coin[];
}

export interface FormattedAssetAmount {
  value: number;
  display: string;
  symbol: string;
  baseAmount: string;
  displayAmount: string;
  asset: Asset;
  decimals: number;
  dollarValue?: number;
  price: number;
  imageUrl: string;
}

export interface PriceData {
  price: number;
  last_updated?: string;
  source?: string;
}
