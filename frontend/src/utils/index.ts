export { cn } from "./classname-util";
export * from "./jwt-decoder";
// webauthn-utils moved to auth/passkey (import from there if needed)
export * from "./authenticator-utils";
export * from "./wallet-utils";

// Formatting utilities
export {
  basicFormatCurrency,
  basicFormatTokenAmount,
  detectUserLocale,
  formatBalance,
  truncateAddress,
  formatIBCAddresses,
  IBC_ADDRESS_PATTERN,
  getCommaSeperatedNumber,
  removeTrailingDigits,
  formatCoins,
  formatXionAmount,
  DENOM_DECIMALS,
  DENOM_DISPLAY_MAP,
} from "./formatters";

// Fee calculation utilities
export { formatGasPrice, getGasCalculation } from "./fees";

// Re-export crypto utilities from @burnt-labs/signers (better implementation)
export {
  getHumanReadablePubkey,
  encodeHex,
  validateBech32Address,
} from "@burnt-labs/signers/crypto";

export function getEnvNumberOrThrow(key: string, value?: string): number {
  const val = Number(value);
  if (isNaN(val)) {
    throw new Error(`Environment variable ${key} must be defined`);
  }

  return val;
}

export function getEnvStringOrThrow(key: string, value?: string): string {
  if (!value) {
    throw new Error(`Environment variable ${key} must be defined`);
  }

  return value;
}
