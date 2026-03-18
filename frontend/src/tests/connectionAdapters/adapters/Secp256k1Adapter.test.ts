import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CONNECTION_METHOD } from "../../../auth/AuthStateManager";
import {
  Secp256k1Adapter,
  createKeplrAdapter,
  createOKXAdapter,
} from "../../../connectionAdapters/adapters/Secp256k1Adapter";

// Mock AADirectSigner - class must be defined inside factory due to hoisting
vi.mock("@burnt-labs/signers", async () => {
  const actual = await vi.importActual("@burnt-labs/signers");

  class MockAADirectSigner {
    offlineSigner: unknown;
    abstractAccount: string;
    accountAuthenticatorIndex: number;
    signArbitraryFn: (
      chainId: string,
      signer: string,
      data: string | Uint8Array,
    ) => Promise<unknown>;

    constructor(
      offlineSigner: unknown,
      account: string,
      index: number,
      signArbitraryFn: (
        chainId: string,
        signer: string,
        data: string | Uint8Array,
      ) => Promise<unknown>,
    ) {
      this.offlineSigner = offlineSigner;
      this.abstractAccount = account;
      this.accountAuthenticatorIndex = index;
      this.signArbitraryFn = signArbitraryFn;
    }
  }

  return {
    ...actual,
    AADirectSigner: MockAADirectSigner,
  };
});

describe("Secp256k1Adapter", () => {
  describe("Keplr variant", () => {
    let adapter: Secp256k1Adapter;
    let mockKeplr: {
      enable: ReturnType<typeof vi.fn>;
      getKey: ReturnType<typeof vi.fn>;
      signArbitrary: ReturnType<typeof vi.fn>;
      getOfflineSigner: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockKeplr = {
        enable: vi.fn(),
        getKey: vi.fn(),
        signArbitrary: vi.fn(),
        getOfflineSigner: vi.fn(),
      };

      Object.defineProperty(window, "keplr", {
        value: mockKeplr,
        writable: true,
        configurable: true,
      });

      adapter = new Secp256k1Adapter("keplr");
    });

    afterEach(() => {
      vi.clearAllMocks();
      // @ts-expect-error - cleaning up mock
      delete window.keplr;
    });

    describe("static properties", () => {
      it("should have correct authenticator type", () => {
        expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.Secp256K1);
      });

      it("should have correct connection method for Keplr", () => {
        expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.Keplr);
      });

      it("should have correct name for Keplr", () => {
        expect(adapter.name).toBe("Keplr");
      });
    });

    describe("isInstalled", () => {
      it("should return true when Keplr is installed", () => {
        expect(adapter.isInstalled()).toBe(true);
      });

      it("should return false when Keplr is not installed", () => {
        // @ts-expect-error - testing undefined case
        delete window.keplr;
        expect(adapter.isInstalled()).toBe(false);
      });
    });

    describe("enable", () => {
      it("should call keplr.enable with chainId", async () => {
        mockKeplr.enable.mockResolvedValue(undefined);

        await adapter.enable("xion-testnet-1");

        expect(mockKeplr.enable).toHaveBeenCalledWith("xion-testnet-1");
      });

      it("should throw when Keplr is not installed", async () => {
        // @ts-expect-error - testing undefined case
        delete window.keplr;

        await expect(adapter.enable("xion-testnet-1")).rejects.toThrow(
          "Keplr wallet not installed",
        );
      });
    });

    describe("getKey", () => {
      it("should return key from Keplr", async () => {
        const mockKey = {
          name: "Test Wallet",
          algo: "secp256k1",
          pubKey: new Uint8Array([1, 2, 3]),
          address: new Uint8Array([4, 5, 6]),
          bech32Address: "xion1testaddress",
          isNanoLedger: false,
          isKeystone: false,
        };
        mockKeplr.getKey.mockResolvedValue(mockKey);

        const key = await adapter.getKey("xion-testnet-1");

        expect(mockKeplr.getKey).toHaveBeenCalledWith("xion-testnet-1");
        expect(key).toEqual(mockKey);
      });

      it("should throw when key is null", async () => {
        mockKeplr.getKey.mockResolvedValue(null);

        await expect(adapter.getKey("xion-testnet-1")).rejects.toThrow(
          "Failed to get key from Keplr",
        );
      });

      it("should throw when pubKey is missing", async () => {
        mockKeplr.getKey.mockResolvedValue({ name: "Test" });

        await expect(adapter.getKey("xion-testnet-1")).rejects.toThrow(
          "Failed to get key from Keplr",
        );
      });
    });

    describe("signArbitrary", () => {
      it("should sign string data", async () => {
        const mockSignature = {
          pub_key: { type: "tendermint/PubKeySecp256k1", value: "abc" },
          signature: "sig123",
        };
        mockKeplr.signArbitrary.mockResolvedValue(mockSignature);

        const result = await adapter.signArbitrary(
          "xion-testnet-1",
          "xion1signer",
          "Hello, World!",
        );

        expect(mockKeplr.signArbitrary).toHaveBeenCalledWith(
          "xion-testnet-1",
          "xion1signer",
          "Hello, World!",
        );
        expect(result).toEqual(mockSignature);
      });

      it("should convert Uint8Array data", async () => {
        const mockSignature = { signature: "sig" };
        mockKeplr.signArbitrary.mockResolvedValue(mockSignature);

        const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        await adapter.signArbitrary("xion-testnet-1", "xion1signer", data);

        expect(mockKeplr.signArbitrary).toHaveBeenCalledWith(
          "xion-testnet-1",
          "xion1signer",
          expect.any(Uint8Array),
        );
      });
    });

    describe("getOfflineSigner", () => {
      it("should return offline signer from Keplr", () => {
        const mockOfflineSigner = { getAccounts: vi.fn() };
        mockKeplr.getOfflineSigner.mockReturnValue(mockOfflineSigner);

        const signer = adapter.getOfflineSigner("xion-testnet-1");

        expect(mockKeplr.getOfflineSigner).toHaveBeenCalledWith(
          "xion-testnet-1",
        );
        expect(signer).toBe(mockOfflineSigner);
      });
    });

    describe("getSigner", () => {
      it("should return AADirectSigner instance", async () => {
        const mockOfflineSigner = { getAccounts: vi.fn() };
        mockKeplr.getOfflineSigner.mockReturnValue(mockOfflineSigner);

        const signer = await adapter.getSigner(
          "xion-testnet-1",
          "xion1account",
          2,
        );

        // Verify signer has expected properties from AADirectSigner
        expect(signer).toBeDefined();
        expect(signer.abstractAccount).toBe("xion1account");
        expect(signer.accountAuthenticatorIndex).toBe(2);
        expect(signer.offlineSigner).toBe(mockOfflineSigner);
      });

      it("should pass signArbitrary function to AADirectSigner", async () => {
        const mockOfflineSigner = { getAccounts: vi.fn() };
        mockKeplr.getOfflineSigner.mockReturnValue(mockOfflineSigner);

        const mockSignature = { signature: "test-sig" };
        mockKeplr.signArbitrary.mockResolvedValue(mockSignature);

        const signer = await adapter.getSigner(
          "xion-testnet-1",
          "xion1account",
          2,
        );

        // Call the signArbitrary function on the signer
        const result = await signer.signArbitraryFn(
          "xion-testnet-1",
          "xion1signer",
          "message",
        );

        expect(result).toEqual(mockSignature);
        expect(mockKeplr.signArbitrary).toHaveBeenCalledWith(
          "xion-testnet-1",
          "xion1signer",
          "message",
        );
      });
    });
  });

  describe("OKX variant", () => {
    let adapter: Secp256k1Adapter;
    let mockOKXKeplr: {
      enable: ReturnType<typeof vi.fn>;
      getKey: ReturnType<typeof vi.fn>;
      signArbitrary: ReturnType<typeof vi.fn>;
      getOfflineSigner: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockOKXKeplr = {
        enable: vi.fn(),
        getKey: vi.fn(),
        signArbitrary: vi.fn(),
        getOfflineSigner: vi.fn(),
      };

      Object.defineProperty(window, "okxwallet", {
        value: { keplr: mockOKXKeplr },
        writable: true,
        configurable: true,
      });

      adapter = new Secp256k1Adapter("okx");
    });

    afterEach(() => {
      vi.clearAllMocks();
      // @ts-expect-error - cleaning up mock
      delete window.okxwallet;
    });

    describe("static properties", () => {
      it("should have correct connection method for OKX", () => {
        expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.OKX);
      });

      it("should have correct name for OKX", () => {
        expect(adapter.name).toBe("OKX Wallet");
      });
    });

    describe("isInstalled", () => {
      it("should return true when OKX is installed", () => {
        expect(adapter.isInstalled()).toBe(true);
      });

      it("should return false when OKX is not installed", () => {
        // @ts-expect-error - testing undefined case
        delete window.okxwallet;
        expect(adapter.isInstalled()).toBe(false);
      });

      it("should return false when okxwallet.keplr is undefined", () => {
        Object.defineProperty(window, "okxwallet", {
          value: {},
          writable: true,
          configurable: true,
        });
        expect(adapter.isInstalled()).toBe(false);
      });
    });

    describe("enable", () => {
      it("should call okxwallet.keplr.enable with chainId", async () => {
        mockOKXKeplr.enable.mockResolvedValue(undefined);

        await adapter.enable("xion-testnet-1");

        expect(mockOKXKeplr.enable).toHaveBeenCalledWith("xion-testnet-1");
      });

      it("should throw when OKX is not installed", async () => {
        // @ts-expect-error - testing undefined case
        delete window.okxwallet;

        await expect(adapter.enable("xion-testnet-1")).rejects.toThrow(
          "OKX wallet not installed",
        );
      });
    });

    describe("getKey", () => {
      it("should return key from OKX", async () => {
        const mockKey = {
          name: "OKX Wallet",
          algo: "secp256k1",
          pubKey: new Uint8Array([1, 2, 3]),
          address: new Uint8Array([4, 5, 6]),
          bech32Address: "xion1okxaddress",
          isNanoLedger: false,
          isKeystone: false,
        };
        mockOKXKeplr.getKey.mockResolvedValue(mockKey);

        const key = await adapter.getKey("xion-testnet-1");

        expect(key).toEqual(mockKey);
      });
    });
  });

  describe("factory functions", () => {
    beforeEach(() => {
      Object.defineProperty(window, "keplr", {
        value: {},
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "okxwallet", {
        value: { keplr: {} },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      // @ts-expect-error - cleaning up mock
      delete window.keplr;
      // @ts-expect-error - cleaning up mock
      delete window.okxwallet;
    });

    it("createKeplrAdapter should create Keplr adapter", () => {
      const adapter = createKeplrAdapter();
      expect(adapter).toBeInstanceOf(Secp256k1Adapter);
      expect(adapter.name).toBe("Keplr");
      expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.Keplr);
    });

    it("createOKXAdapter should create OKX adapter", () => {
      const adapter = createOKXAdapter();
      expect(adapter).toBeInstanceOf(Secp256k1Adapter);
      expect(adapter.name).toBe("OKX Wallet");
      expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.OKX);
    });
  });
});
