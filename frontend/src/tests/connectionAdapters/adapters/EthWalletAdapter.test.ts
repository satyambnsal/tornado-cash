import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CONNECTION_METHOD } from "../../../auth/AuthStateManager";
import {
  EthWalletAdapter,
  createMetaMaskAdapter,
} from "../../../connectionAdapters/adapters/EthWalletAdapter";

// Mock AAEthSigner - class must be defined inside factory due to hoisting
vi.mock("@burnt-labs/signers", async () => {
  const actual = await vi.importActual("@burnt-labs/signers");

  class MockAAEthSigner {
    abstractAccount: string;
    accountAuthenticatorIndex: number;
    signingFn: (message: string) => Promise<string>;

    constructor(
      account: string,
      index: number,
      signingFn: (message: string) => Promise<string>,
    ) {
      this.abstractAccount = account;
      this.accountAuthenticatorIndex = index;
      this.signingFn = signingFn;
    }
  }

  return {
    ...actual,
    AAEthSigner: MockAAEthSigner,
  };
});

describe("EthWalletAdapter", () => {
  let adapter: EthWalletAdapter;
  let mockEthereum: {
    isMetaMask: boolean;
    request: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockEthereum = {
      isMetaMask: true,
      request: vi.fn(),
    };

    // Mock window.ethereum
    Object.defineProperty(window, "ethereum", {
      value: mockEthereum,
      writable: true,
      configurable: true,
    });

    adapter = new EthWalletAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - cleaning up mock
    delete window.ethereum;
  });

  describe("static properties", () => {
    it("should have correct authenticator type", () => {
      expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.EthWallet);
    });

    it("should have correct connection method", () => {
      expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.Metamask);
    });

    it("should have correct name", () => {
      expect(adapter.name).toBe("MetaMask");
    });
  });

  describe("isInstalled", () => {
    it("should return true when MetaMask is installed", () => {
      expect(adapter.isInstalled()).toBe(true);
    });

    it("should return false when window.ethereum is undefined", () => {
      // @ts-expect-error - testing undefined case
      delete window.ethereum;
      expect(adapter.isInstalled()).toBe(false);
    });

    it("should return false when isMetaMask flag is false", () => {
      mockEthereum.isMetaMask = false;
      expect(adapter.isInstalled()).toBe(false);
    });
  });

  describe("enable", () => {
    it("should request account access", async () => {
      mockEthereum.request.mockResolvedValue(["0x1234"]);

      await adapter.enable("xion-testnet-1");

      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: "eth_requestAccounts",
      });
    });

    it("should throw when ethereum is not available", async () => {
      // @ts-expect-error - testing undefined case
      delete window.ethereum;

      await expect(adapter.enable("xion-testnet-1")).rejects.toThrow(
        "Ethereum wallet not installed",
      );
    });

    it("should throw when MetaMask is not detected", async () => {
      mockEthereum.isMetaMask = false;

      await expect(adapter.enable("xion-testnet-1")).rejects.toThrow(
        "MetaMask not detected",
      );
    });
  });

  describe("getKey", () => {
    it("should return key with Ethereum address", async () => {
      const mockAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f1F43";
      mockEthereum.request.mockResolvedValue([mockAddress]);

      const key = await adapter.getKey("xion-testnet-1");

      expect(key.name).toBe("MetaMask");
      expect(key.algo).toBe("secp256k1");
      expect(key.pubKey).toEqual(new Uint8Array(0));
      expect(key.bech32Address).toBe(mockAddress);
      expect(key.isNanoLedger).toBe(false);
      expect(key.isKeystone).toBe(false);
    });

    it("should throw when no accounts are found", async () => {
      mockEthereum.request.mockResolvedValue([]);

      await expect(adapter.getKey("xion-testnet-1")).rejects.toThrow(
        "No accounts found in MetaMask",
      );
    });

    it("should throw when accounts is null", async () => {
      mockEthereum.request.mockResolvedValue(null);

      await expect(adapter.getKey("xion-testnet-1")).rejects.toThrow(
        "No accounts found in MetaMask",
      );
    });
  });

  describe("signArbitrary", () => {
    it("should sign string data using personal_sign", async () => {
      const mockSignature = "0xmocksignature123";
      mockEthereum.request.mockResolvedValue(mockSignature);

      const result = await adapter.signArbitrary(
        "xion-testnet-1",
        "0x1234",
        "Hello, World!",
      );

      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: "personal_sign",
        params: ["Hello, World!", "0x1234"],
      });
      expect(result.signature).toBe("mocksignature123"); // 0x prefix removed
      expect(result.pub_key.type).toBe("tendermint/PubKeySecp256k1");
      expect(result.pub_key.value).toBe("");
    });

    it("should convert Uint8Array data to string", async () => {
      const mockSignature = "0xmocksig";
      mockEthereum.request.mockResolvedValue(mockSignature);

      const data = new TextEncoder().encode("Test message");
      await adapter.signArbitrary("xion-testnet-1", "0x1234", data);

      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: "personal_sign",
        params: ["Test message", "0x1234"],
      });
    });

    it("should throw when signature is null", async () => {
      mockEthereum.request.mockResolvedValue(null);

      await expect(
        adapter.signArbitrary("xion-testnet-1", "0x1234", "test"),
      ).rejects.toThrow("Failed to get signature");
    });
  });

  describe("getOfflineSigner", () => {
    it("should throw error since Ethereum wallets do not support offline signer", () => {
      expect(() => adapter.getOfflineSigner("xion-testnet-1")).toThrow(
        "MetaMask does not support CosmJS OfflineSigner. Use AAEthSigner instead.",
      );
    });
  });

  describe("getSigner", () => {
    it("should return signer with correct properties", () => {
      const abstractAccount = "xion1testaccount";
      const authenticatorIndex = 2;

      const signer = adapter.getSigner(abstractAccount, authenticatorIndex);

      expect(signer.abstractAccount).toBe(abstractAccount);
      expect(signer.accountAuthenticatorIndex).toBe(authenticatorIndex);
    });

    it("should create signing function that uses personal_sign", async () => {
      const mockSignature = "0xsigned";
      mockEthereum.request
        .mockResolvedValueOnce(["0xaccount"]) // eth_requestAccounts
        .mockResolvedValueOnce(mockSignature); // personal_sign

      const signer = adapter.getSigner("xion1test", 0);

      // Call the signing function on the signer
      const result = await signer.signingFn("test message");

      expect(result).toBe(mockSignature);
      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: "eth_requestAccounts",
      });
      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: "personal_sign",
        params: ["test message", "0xaccount"],
      });
    });
  });

  describe("createMetaMaskAdapter factory", () => {
    it("should create a new EthWalletAdapter instance", () => {
      const adapter = createMetaMaskAdapter();
      expect(adapter).toBeInstanceOf(EthWalletAdapter);
    });
  });
});
