import type { FormattedAssetAmount, Asset } from "../types/assets";

/**
 * Detects the user's locale from browser or system environment
 * Falls back to "en-US" if detection fails
 */
export const detectUserLocale = (): string => {
  if (typeof navigator !== "undefined") {
    return navigator.language || navigator.languages?.[0] || "en-US";
  }

  if (typeof process !== "undefined") {
    return process.env.LANG?.split(".")[0].replace("_", "-") || "en-US";
  }

  return "en-US";
};

/**
 * Formats a number as currency with specified decimal places
 * Uses the detected user locale for proper number formatting
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 */
export const basicFormatCurrency = (value: number, decimals: number = 2) => {
  const locale = detectUserLocale();
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formats a token amount with appropriate decimal precision
 * USDC is formatted with 2 decimals, other tokens with 4 decimals
 *
 * @param asset - The formatted asset amount to display
 */
export const basicFormatTokenAmount = (asset: FormattedAssetAmount) => {
  if (asset.symbol === "USDC") {
    return basicFormatCurrency(asset.value, 2);
  }
  return basicFormatCurrency(asset.value, 4);
};

/**
 * Formats a number as a currency with symbol
 * Uses Intl.NumberFormat for proper currency formatting
 *
 * @param number - The amount to format
 * @param locale - The locale to use (default: "en-US")
 * @param currency - The currency code (default: "USD")
 * @returns Formatted currency string without currency code
 */
export function formatBalance(
  number: number,
  locale: string = "en-US",
  currency: string = "USD",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
  })
    .format(number)
    .replace(currency, "")
    .trim();
}

/**
 * Truncates a long address for display
 * Shows the first and last characters with ellipsis in between
 *
 * @param address - The address string to truncate
 * @param frontLength - Number of characters to show at the start (default: 8)
 * @param backLength - Number of characters to show at the end (default: 4)
 * @returns Truncated address or empty string if address is undefined
 */
export function truncateAddress(
  address: string | undefined,
  frontLength: number = 8,
  backLength: number = 4,
) {
  if (!address) {
    return "";
  }
  return (
    address.slice(0, frontLength) +
    "..." +
    address.slice(address.length - backLength, address.length)
  );
}

/**
 * Pattern to match IBC addresses in text
 * Format: ibc/[64 hex characters]
 */
export const IBC_ADDRESS_PATTERN = /ibc\/[A-F0-9]{64}/gi;

/**
 * Formats text by replacing IBC addresses with human-readable asset symbols
 * If the asset is not found, shows a truncated version of the IBC hash
 *
 * @param text - The text containing IBC addresses to format
 * @param getAssetByDenom - Function to retrieve asset information by denomination
 * @returns The formatted text with IBC addresses replaced
 */
export const formatIBCAddresses = (
  text: string,
  getAssetByDenom: (denom: string) => Asset | undefined,
): string => {
  let formattedText = text;

  const ibcMatches = text.matchAll(IBC_ADDRESS_PATTERN);

  for (const match of ibcMatches) {
    const ibcAddress = match[0];
    const asset = getAssetByDenom(ibcAddress);

    if (asset) {
      formattedText = formattedText.replace(ibcAddress, asset.symbol);
    } else {
      const hash = ibcAddress.substring(4);
      formattedText = formattedText.replace(
        ibcAddress,
        `ibc/${hash.substring(0, 4)}...${hash.substring(hash.length - 4)}`,
      );
    }
  }

  return formattedText;
};

/**
 * Helper function to remove trailing millionth digits
 * Divides the number by 1,000,000
 */
export function removeTrailingDigits(number: number) {
  return number / 1000000;
}

/**
 * Formats a number with comma separators and appropriate decimal places
 * Automatically adjusts decimal precision based on the number's magnitude
 *
 * @param number - The number to format
 * @returns Formatted number string with comma separators
 */
export function getCommaSeperatedNumber(number: number) {
  const millionthPart = removeTrailingDigits(number);
  return millionthPart.toLocaleString("en-US", {
    minimumFractionDigits: Math.max(
      0,
      Math.ceil(
        Math.abs(millionthPart) < 1 ? Math.log10(Math.abs(millionthPart)) : 0,
      ),
    ),
    maximumFractionDigits: 6,
  });
}

// Re-export formatCoins and related utilities from @burnt-labs/account-management
export {
  formatCoins,
  formatXionAmount,
  DENOM_DECIMALS,
  DENOM_DISPLAY_MAP,
} from "@burnt-labs/account-management";
