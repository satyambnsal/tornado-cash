import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WalletAccountError,
  getErrorMessageForUI,
  getEthWalletAddress,
  getSecp256k1Pubkey,
  signWithEthWallet,
  signWithSecp256k1Wallet,
} from "../../utils/wallet-utils";

// Mock validation functions from @burnt-labs/signers/crypto
vi.mock("@burnt-labs/signers/crypto", () => ({
  validateBech32Address: vi.fn(),
  validateEthereumAddress: vi.fn(),
  normalizeEthereumAddress: vi.fn((addr: string) => addr.toLowerCase()),
  formatEthSignature: vi.fn((sig: string) => sig),
  // formatSecp256k1Signature should convert base64 to hex
  formatSecp256k1Signature: vi.fn((sig: string) => {
    // If it's base64, convert to hex
    if (!sig.startsWith("0x") && /^[A-Za-z0-9+/=]+$/.test(sig)) {
      return Buffer.from(sig, "base64").toString("hex");
    }
    return sig;
  }),
}));

describe("WalletAccountError", () => {
  it("constructs correctly", () => {
    const error = new WalletAccountError("tech message", "user message");
    expect(error.message).toBe("tech message");
    expect(error.userMessage).toBe("user message");
    expect(error.name).toBe("WalletAccountError");
  });
});

describe("getErrorMessageForUI", () => {
  it("returns userMessage for WalletAccountError", () => {
    const error = new WalletAccountError("tech", "user friendly");
    expect(getErrorMessageForUI(error)).toBe("user friendly");
  });

  it("maps common error messages", () => {
    expect(getErrorMessageForUI(new Error("User rejected request"))).toBe(
      "Signature cancelled",
    );
    expect(getErrorMessageForUI(new Error("Provider not installed"))).toBe(
      "Wallet not found",
    );
    expect(
      getErrorMessageForUI(
        new Error("pubkey recovered from signature does not match"),
      ),
    ).toBe("Signature verification failed");
    expect(getErrorMessageForUI(new Error("signature is invalid"))).toBe(
      "Invalid signature",
    );
    expect(getErrorMessageForUI(new Error("authorization not found"))).toBe(
      "Service error. Please contact support",
    );
    expect(getErrorMessageForUI(new Error("fee-grant not found"))).toBe(
      "Fee grant not found. Please contact support",
    );
    expect(getErrorMessageForUI(new Error("account already exists"))).toBe(
      "Account already exists",
    );
    expect(getErrorMessageForUI(new Error("network error"))).toBe(
      "Network error. Check your connection",
    );
  });

  it("returns default message for unknown errors", () => {
    expect(getErrorMessageForUI(new Error("unknown error"))).toBe(
      "Something went wrong. Please try again",
    );
    expect(getErrorMessageForUI("string error")).toBe(
      "Something went wrong. Please try again",
    );
  });
});

describe("getEthWalletAddress", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  it("throws if ethereum is not installed", async () => {
    await expect(getEthWalletAddress()).rejects.toThrow(
      "MetaMask not installed",
    );
  });

  it("returns address if accounts found", async () => {
    window.ethereum = {
      isMetaMask: true,
      request: vi.fn().mockResolvedValue(["0x123"]),
    } as unknown as typeof window.ethereum;
    const address = await getEthWalletAddress();
    expect(address).toBe("0x123");
  });

  it("throws if no accounts found", async () => {
    window.ethereum = {
      isMetaMask: true,
      request: vi.fn().mockResolvedValue([]),
    } as unknown as typeof window.ethereum;
    await expect(getEthWalletAddress()).rejects.toThrow("No accounts found");
  });

  it("wraps unknown errors", async () => {
    window.ethereum = {
      isMetaMask: true,
      request: vi.fn().mockRejectedValue(new Error("Unknown")),
    } as unknown as typeof window.ethereum;
    await expect(getEthWalletAddress()).rejects.toThrow(
      "Failed to get Ethereum address",
    );
  });
});

describe("getSecp256k1Pubkey", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  it("throws if wallet not installed (keplr)", async () => {
    await expect(getSecp256k1Pubkey("chain-id", "keplr")).rejects.toThrow(
      "Keplr not installed",
    );
  });

  it("throws if wallet not installed (okx)", async () => {
    await expect(getSecp256k1Pubkey("chain-id", "okx")).rejects.toThrow(
      "OKX not installed",
    );
  });

  it("returns pubkey info for keplr", async () => {
    const mockKey = {
      pubKey: new Uint8Array([1, 2, 3]),
      // Use a valid bech32 address format (xion1 + 39 chars)
      bech32Address: "xion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6ltfe6",
    };
    window.keplr = {
      getKey: vi.fn().mockResolvedValue(mockKey),
    } as unknown as typeof window.keplr;

    const result = await getSecp256k1Pubkey("chain-id", "keplr");
    expect(result.address).toBe("xion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6ltfe6");
    expect(result.pubkeyHex).toBe("010203");
    expect(result.pubkeyBase64).toBe("AQID");
  });

  it("handles OKX wallet specific logic", async () => {
    const mockKey = {
      pubKey: new Uint8Array([1, 2, 3]),
      // Use a valid bech32 address format
      bech32Address: "xion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6ltfe6",
    };
    window.okxwallet = {
      keplr: {
        enable: vi.fn(),
        getKey: vi.fn().mockResolvedValue(mockKey),
      },
    } as unknown as typeof window.okxwallet;

    const result = await getSecp256k1Pubkey("chain-id", "okx");
    expect(result.address).toBe("xion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6ltfe6");
    expect(window.okxwallet.keplr.enable).toHaveBeenCalledWith("chain-id");
  });

  it("throws if okxwallet.keplr is not available", async () => {
    window.okxwallet = {} as unknown as typeof window.okxwallet;
    await expect(getSecp256k1Pubkey("chain-id", "okx")).rejects.toThrow(
      "OKX Keplr integration not found",
    );
  });

  it("throws if no pubkey returned", async () => {
    window.keplr = {
      getKey: vi.fn().mockResolvedValue({ bech32Address: "xion1addr" }),
    } as unknown as typeof window.keplr;
    await expect(getSecp256k1Pubkey("chain-id", "keplr")).rejects.toThrow(
      "No public key found",
    );
  });

  it("throws if key is null", async () => {
    window.keplr = {
      getKey: vi.fn().mockResolvedValue(null),
    } as unknown as typeof window.keplr;
    await expect(getSecp256k1Pubkey("chain-id", "keplr")).rejects.toThrow(
      "No public key found",
    );
  });

  it("wraps unknown errors", async () => {
    window.keplr = {
      getKey: vi.fn().mockRejectedValue(new Error("Unknown error")),
    } as unknown as typeof window.keplr;
    await expect(getSecp256k1Pubkey("chain-id", "keplr")).rejects.toThrow(
      "Failed to get public key",
    );
  });

  it("re-throws WalletAccountError", async () => {
    window.keplr = {
      getKey: vi
        .fn()
        .mockRejectedValue(new WalletAccountError("tech", "user denied")),
    } as unknown as typeof window.keplr;
    await expect(getSecp256k1Pubkey("chain-id", "keplr")).rejects.toThrow(
      "tech",
    );
  });
});

describe("signWithEthWallet", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  it("throws if ethereum not installed", async () => {
    await expect(signWithEthWallet("msg", "addr")).rejects.toThrow(
      "MetaMask not installed",
    );
  });

  it("returns signature", async () => {
    // Mock a valid Ethereum signature (65 bytes = 130 hex chars + 0x prefix)
    const mockSignature =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b";
    window.ethereum = {
      isMetaMask: true,
      request: vi.fn().mockResolvedValue(mockSignature),
    } as unknown as typeof window.ethereum;
    const sig = await signWithEthWallet("msg", "addr");
    expect(sig).toBe(mockSignature);
  });

  it("throws if no signature returned", async () => {
    window.ethereum = {
      isMetaMask: true,
      request: vi.fn().mockResolvedValue(null),
    } as unknown as typeof window.ethereum;
    await expect(signWithEthWallet("msg", "addr")).rejects.toThrow(
      "No signature returned",
    );
  });

  it("wraps unknown errors", async () => {
    window.ethereum = {
      isMetaMask: true,
      request: vi.fn().mockRejectedValue(new Error("Unknown error")),
    } as unknown as typeof window.ethereum;
    await expect(signWithEthWallet("msg", "addr")).rejects.toThrow(
      "Failed to sign with Ethereum wallet",
    );
  });

  it("re-throws WalletAccountError", async () => {
    window.ethereum = {
      isMetaMask: true,
      request: vi
        .fn()
        .mockRejectedValue(new WalletAccountError("tech", "user denied")),
    } as unknown as typeof window.ethereum;
    await expect(signWithEthWallet("msg", "addr")).rejects.toThrow("tech");
  });
});

describe("signWithSecp256k1Wallet", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  it("throws if keplr wallet not installed", async () => {
    await expect(
      signWithSecp256k1Wallet("msg", "chain", "addr", "keplr"),
    ).rejects.toThrow("Keplr not installed");
  });

  it("throws if okx wallet not installed", async () => {
    await expect(
      signWithSecp256k1Wallet("msg", "chain", "addr", "okx"),
    ).rejects.toThrow("OKX not installed");
  });

  it("returns hex signature for keplr", async () => {
    window.keplr = {
      signArbitrary: vi.fn().mockResolvedValue({
        signature: "AQID", // Base64 for 010203
      }),
    } as unknown as typeof window.keplr;

    const sig = await signWithSecp256k1Wallet("msg", "chain", "addr", "keplr");
    expect(sig).toBe("010203");
  });

  it("returns hex signature for okx wallet", async () => {
    window.okxwallet = {
      keplr: {
        signArbitrary: vi.fn().mockResolvedValue({
          signature: "AQID",
        }),
      },
    } as unknown as typeof window.okxwallet;

    const sig = await signWithSecp256k1Wallet("msg", "chain", "addr", "okx");
    expect(sig).toBe("010203");
  });

  it("throws if no signature returned", async () => {
    window.keplr = {
      signArbitrary: vi.fn().mockResolvedValue(null),
    } as unknown as typeof window.keplr;
    await expect(
      signWithSecp256k1Wallet("msg", "chain", "addr", "keplr"),
    ).rejects.toThrow("No signature returned");
  });

  it("throws if signature object has no signature property", async () => {
    window.keplr = {
      signArbitrary: vi.fn().mockResolvedValue({ pub_key: "key" }),
    } as unknown as typeof window.keplr;
    await expect(
      signWithSecp256k1Wallet("msg", "chain", "addr", "keplr"),
    ).rejects.toThrow("No signature returned");
  });

  it("wraps unknown errors", async () => {
    window.keplr = {
      signArbitrary: vi.fn().mockRejectedValue(new Error("Unknown error")),
    } as unknown as typeof window.keplr;
    await expect(
      signWithSecp256k1Wallet("msg", "chain", "addr", "keplr"),
    ).rejects.toThrow("Failed to sign with Cosmos wallet");
  });

  it("re-throws WalletAccountError", async () => {
    window.keplr = {
      signArbitrary: vi
        .fn()
        .mockRejectedValue(new WalletAccountError("tech", "user denied")),
    } as unknown as typeof window.keplr;
    await expect(
      signWithSecp256k1Wallet("msg", "chain", "addr", "keplr"),
    ).rejects.toThrow("tech");
  });
});
