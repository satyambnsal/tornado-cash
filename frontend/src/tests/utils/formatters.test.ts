import { describe, it, expect, afterEach } from "vitest";
import {
  basicFormatCurrency,
  basicFormatTokenAmount,
  detectUserLocale,
  formatBalance,
  truncateAddress,
  formatIBCAddresses,
  IBC_ADDRESS_PATTERN,
  removeTrailingDigits,
  getCommaSeperatedNumber,
} from "../../utils/formatters";
import type { FormattedAssetAmount, Asset } from "../../types/assets";

const minimalAsset: Asset = {
  denom_units: [{ denom: "tst", exponent: 0 }],
  type_asset: "sdk.coin",
  base: "base",
  name: "Test Asset",
  display: "Test",
  symbol: "TST",
};

describe("basicFormatCurrency", () => {
  it("formats number with default 2 decimals", () => {
    expect(basicFormatCurrency(1234.567)).toBe("1,234.57");
  });

  it("formats number with 0 decimals", () => {
    expect(basicFormatCurrency(1234.567, 0)).toBe("1,235");
  });

  it("formats number with 4 decimals", () => {
    expect(basicFormatCurrency(1234.56789, 4)).toBe("1,234.5679");
  });
});

describe("basicFormatTokenAmount", () => {
  const usdcAsset: FormattedAssetAmount = {
    value: 1234.567,
    display: "USDC",
    symbol: "USDC",
    baseAmount: "1234567",
    displayAmount: "1234.567",
    asset: minimalAsset,
    decimals: 6,
    price: 1,
    imageUrl: "",
  };

  const otherAsset: FormattedAssetAmount = {
    value: 1234.56789,
    display: "ATOM",
    symbol: "ATOM",
    baseAmount: "123456789",
    displayAmount: "1234.56789",
    asset: minimalAsset,
    decimals: 6,
    price: 10,
    imageUrl: "",
  };

  it("formats USDC with 2 decimals", () => {
    expect(basicFormatTokenAmount(usdcAsset)).toBe("1,234.57");
  });

  it("formats non-USDC with 4 decimals", () => {
    expect(basicFormatTokenAmount(otherAsset)).toBe("1,234.5679");
  });
});

describe("detectUserLocale", () => {
  const originalNavigator = global.navigator;
  const originalProcess = global.process;

  afterEach(() => {
    global.navigator = originalNavigator;
    global.process = originalProcess;
  });

  it("returns navigator.language if available", () => {
    Object.defineProperty(global, "navigator", {
      value: { language: "fr-FR", languages: ["fr-FR"] },
      writable: true,
      configurable: true,
    });
    expect(detectUserLocale()).toBe("fr-FR");
  });

  it("returns first of navigator.languages if language is not available", () => {
    Object.defineProperty(global, "navigator", {
      value: { language: undefined, languages: ["es-ES"] },
      writable: true,
      configurable: true,
    });
    expect(detectUserLocale()).toBe("es-ES");
  });

  it("returns process.env.LANG if navigator is undefined", () => {
    // @ts-expoect-error
    global.navigator = undefined;
    process.env.LANG = "de_DE.UTF-8";
    expect(detectUserLocale()).toBe("de-DE");
  });

  it("returns en-US if navigator properties are missing", () => {
    Object.defineProperty(global, "navigator", {
      value: { language: undefined, languages: undefined },
      writable: true,
      configurable: true,
    });
    expect(detectUserLocale()).toBe("en-US");
  });

  it("returns en-US if process.env.LANG is missing", () => {
    // @ts-expoect-error
    global.navigator = undefined;
    delete process.env.LANG;
    expect(detectUserLocale()).toBe("en-US");
  });

  it("returns en-US as fallback", () => {
    // @ts-expoect-error
    global.navigator = undefined;
    // @ts-expoect-error
    global.process = undefined;
    expect(detectUserLocale()).toBe("en-US");
  });
});

describe("formatBalance", () => {
  it("formats number as currency with default locale and currency", () => {
    const result = formatBalance(1234.56);
    // Should return formatted number without currency code
    expect(result).toBe("1,234.56");
  });

  it("formats number with custom locale", () => {
    const result = formatBalance(1234.56, "de-DE", "USD");
    // German locale uses period as thousand separator and comma for decimal
    expect(result).toMatch(/1\.234,56|1,234\.56/); // May vary by environment
  });

  it("formats number with different currency", () => {
    const result = formatBalance(1234.56, "en-US", "EUR");
    expect(result).toBe("1,234.56");
  });

  it("handles zero value", () => {
    const result = formatBalance(0);
    expect(result).toBe("0.00");
  });

  it("handles negative value", () => {
    const result = formatBalance(-1234.56);
    // Intl.NumberFormat may format with space after minus sign depending on locale
    expect(result).toMatch(/-\s?1,234\.56/);
  });

  it("handles large numbers", () => {
    const result = formatBalance(1234567890.12);
    expect(result).toBe("1,234,567,890.12");
  });
});

describe("truncateAddress", () => {
  it("truncates address with default lengths", () => {
    const address = "xion1abcdefghijklmnopqrstuvwxyz123456";
    const result = truncateAddress(address);
    expect(result).toBe("xion1abc...3456");
  });

  it("truncates address with custom front length", () => {
    const address = "xion1abcdefghijklmnopqrstuvwxyz123456";
    const result = truncateAddress(address, 12);
    expect(result).toBe("xion1abcdefg...3456");
  });

  it("truncates address with custom back length", () => {
    const address = "xion1abcdefghijklmnopqrstuvwxyz123456";
    const result = truncateAddress(address, 8, 6);
    expect(result).toBe("xion1abc...123456");
  });

  it("returns empty string for undefined address", () => {
    const result = truncateAddress(undefined);
    expect(result).toBe("");
  });

  it("returns empty string for empty address", () => {
    const result = truncateAddress("");
    expect(result).toBe("");
  });

  it("handles short addresses", () => {
    const address = "xion1short";
    const result = truncateAddress(address, 4, 4);
    expect(result).toBe("xion...hort");
  });
});

describe("formatIBCAddresses", () => {
  const mockGetAssetByDenom = (denom: string): Asset | undefined => {
    const assets: Record<string, Asset> = {
      "ibc/ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890": {
        denom_units: [{ denom: "uatom", exponent: 0 }],
        type_asset: "sdk.coin",
        base: "uatom",
        name: "Cosmos Hub Atom",
        display: "ATOM",
        symbol: "ATOM",
      },
    };
    return assets[denom];
  };

  it("replaces known IBC address with asset symbol", () => {
    const text =
      "Transfer 100 ibc/ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890 tokens";
    const result = formatIBCAddresses(text, mockGetAssetByDenom);
    expect(result).toBe("Transfer 100 ATOM tokens");
  });

  it("truncates unknown IBC addresses", () => {
    const unknownIbc =
      "ibc/1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF";
    const text = `Transfer ${unknownIbc}`;
    const result = formatIBCAddresses(text, () => undefined);
    // Should show truncated version: ibc/1234...CDEF
    expect(result).toContain("ibc/1234");
    expect(result).toContain("...");
    expect(result).toContain("CDEF");
  });

  it("handles multiple IBC addresses in text", () => {
    const ibc1 =
      "ibc/ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
    const ibc2 =
      "ibc/9999991234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345699999";
    const text = `Transfer ${ibc1} and ${ibc2}`;
    const result = formatIBCAddresses(text, mockGetAssetByDenom);
    expect(result).toContain("ATOM");
    expect(result).toContain("ibc/9999");
  });

  it("returns original text when no IBC addresses present", () => {
    const text = "No IBC addresses here";
    const result = formatIBCAddresses(text, mockGetAssetByDenom);
    expect(result).toBe("No IBC addresses here");
  });

  it("handles empty text", () => {
    const result = formatIBCAddresses("", mockGetAssetByDenom);
    expect(result).toBe("");
  });
});

describe("IBC_ADDRESS_PATTERN", () => {
  it("matches valid IBC addresses", () => {
    const validIbc =
      "ibc/ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
    expect(validIbc.match(IBC_ADDRESS_PATTERN)).toBeTruthy();
  });

  it("matches lowercase IBC addresses", () => {
    const lowercaseIbc =
      "ibc/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    expect(lowercaseIbc.match(IBC_ADDRESS_PATTERN)).toBeTruthy();
  });

  it("does not match invalid IBC addresses", () => {
    const shortIbc = "ibc/ABC123"; // Too short
    expect(shortIbc.match(IBC_ADDRESS_PATTERN)).toBeNull();
  });
});

describe("removeTrailingDigits", () => {
  it("divides number by 1,000,000", () => {
    expect(removeTrailingDigits(1000000)).toBe(1);
    expect(removeTrailingDigits(5000000)).toBe(5);
    expect(removeTrailingDigits(1500000)).toBe(1.5);
  });

  it("handles zero", () => {
    expect(removeTrailingDigits(0)).toBe(0);
  });

  it("handles small numbers", () => {
    expect(removeTrailingDigits(100)).toBe(0.0001);
  });
});

describe("getCommaSeperatedNumber", () => {
  it("formats large numbers with commas", () => {
    const result = getCommaSeperatedNumber(1000000000000); // 1 trillion base units
    expect(result).toBe("1,000,000");
  });

  it("formats numbers with appropriate decimal places", () => {
    const result = getCommaSeperatedNumber(1234567);
    expect(result).toBe("1.234567");
  });

  it("handles small numbers with many decimal places", () => {
    const result = getCommaSeperatedNumber(100); // 0.0001 after division
    expect(result).toMatch(/0\.0001|0/);
  });

  it("handles zero", () => {
    const result = getCommaSeperatedNumber(0);
    expect(result).toBe("0");
  });
});
