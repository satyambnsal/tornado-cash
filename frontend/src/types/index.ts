import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
export * from "./chain";
export * from "./migration";
export * from "./treasury-types";
export * from "./wallet-account-types";

export type authenticatorTypes =
  | "SECP256K1"
  | "ETHWALLET"
  | "JWT"
  | "PASSKEY"
  | "ZKEMAIL";
export type JwtSubType =
  | "email"
  | "google"
  | "apple"
  | "github"
  | "twitter"
  | "x";

export type Network = "testnet" | "mainnet";

export interface AuthenticatorNodes {
  __typename: string;
  id: string;
  type: string;
  authenticator: string;
  authenticatorIndex: number;
  version: string;
}

export interface AccountAuthenticators {
  __typename: string;
  nodes: AuthenticatorNodes[];
}

export interface AbstraxionAccount {
  __typename: string;
  id: string; // bech32Address
  node: {
    authenticators: AuthenticatorNodes[];
    smart_account: string;
  };
  currentAuthenticatorIndex: number;
}

export interface useSmartAccountProps {
  data?: AbstraxionAccount;
  isConnected: boolean;
  isConnecting?: boolean;
  isReconnecting?: boolean;
}

export interface BalanceInfo {
  // In USDC
  total: number;
  balances: Coin[];
}
