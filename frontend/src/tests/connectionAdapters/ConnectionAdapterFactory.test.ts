import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUTHENTICATOR_TYPE, type AuthenticatorType } from "@burnt-labs/signers";
import { CONNECTION_METHOD } from "../../auth/AuthStateManager";
import {
  getConnectionAdapter,
  isConnectionAvailable,
  getAvailableConnections,
} from "../../connectionAdapters/ConnectionAdapterFactory";

// Mock the adapter modules
vi.mock("../../connectionAdapters/adapters/Secp256k1Adapter", () => ({
  createKeplrAdapter: vi.fn(() => ({
    authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
    connectionMethod: CONNECTION_METHOD.Keplr,
    name: "Keplr",
    isInstalled: vi.fn(() => true),
  })),
  createOKXAdapter: vi.fn(() => ({
    authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
    connectionMethod: CONNECTION_METHOD.OKX,
    name: "OKX Wallet",
    isInstalled: vi.fn(() => false),
  })),
}));

vi.mock("../../connectionAdapters/adapters/EthWalletAdapter", () => ({
  createMetaMaskAdapter: vi.fn(() => ({
    authenticatorType: AUTHENTICATOR_TYPE.EthWallet,
    connectionMethod: CONNECTION_METHOD.Metamask,
    name: "MetaMask",
    isInstalled: vi.fn(() => true),
  })),
}));

vi.mock("../../connectionAdapters/adapters/JWTAdapter", () => ({
  createJWTAdapter: vi.fn(() => ({
    authenticatorType: AUTHENTICATOR_TYPE.JWT,
    connectionMethod: CONNECTION_METHOD.Stytch,
    name: "Stytch (Social Login)",
    isInstalled: vi.fn(() => true),
  })),
}));

vi.mock("../../connectionAdapters/adapters/PasskeyAdapter", () => ({
  createPasskeyAdapter: vi.fn(() => ({
    authenticatorType: AUTHENTICATOR_TYPE.Passkey,
    connectionMethod: CONNECTION_METHOD.Passkey,
    name: "Passkey (WebAuthn)",
    isInstalled: vi.fn(() => true),
  })),
}));

vi.mock("../../connectionAdapters/adapters/ZKEmailAdapter", () => ({
  createZKEmailAdapter: vi.fn(() => ({
    authenticatorType: AUTHENTICATOR_TYPE.ZKEmail,
    connectionMethod: CONNECTION_METHOD.ZKEmail,
    name: "ZK-Email",
    isInstalled: vi.fn(() => true),
  })),
}));

describe("ConnectionAdapterFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConnectionAdapter", () => {
    describe("Secp256k1 wallets", () => {
      it("should return Keplr adapter for Secp256k1 + Keplr", () => {
        const adapter = getConnectionAdapter(
          AUTHENTICATOR_TYPE.Secp256K1,
          CONNECTION_METHOD.Keplr,
        );
        expect(adapter.name).toBe("Keplr");
        expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.Secp256K1);
      });

      it("should return OKX adapter for Secp256k1 + OKX", () => {
        const adapter = getConnectionAdapter(
          AUTHENTICATOR_TYPE.Secp256K1,
          CONNECTION_METHOD.OKX,
        );
        expect(adapter.name).toBe("OKX Wallet");
      });

      it("should throw for unsupported Secp256k1 connection method", () => {
        expect(() =>
          getConnectionAdapter(
            AUTHENTICATOR_TYPE.Secp256K1,
            CONNECTION_METHOD.Metamask,
          ),
        ).toThrow("Unsupported Secp256k1 connection method: metamask");
      });
    });

    describe("EthWallet", () => {
      it("should return MetaMask adapter for EthWallet + Metamask", () => {
        const adapter = getConnectionAdapter(
          AUTHENTICATOR_TYPE.EthWallet,
          CONNECTION_METHOD.Metamask,
        );
        expect(adapter.name).toBe("MetaMask");
        expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.EthWallet);
      });

      it("should throw for unsupported EthWallet connection method", () => {
        expect(() =>
          getConnectionAdapter(
            AUTHENTICATOR_TYPE.EthWallet,
            CONNECTION_METHOD.Keplr,
          ),
        ).toThrow("Unsupported EthWallet connection method: keplr");
      });
    });

    describe("JWT authentication", () => {
      it("should return JWT adapter for JWT + Stytch", () => {
        const adapter = getConnectionAdapter(
          AUTHENTICATOR_TYPE.JWT,
          CONNECTION_METHOD.Stytch,
        );
        expect(adapter.name).toBe("Stytch (Social Login)");
        expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.JWT);
      });

      it("should throw for unsupported JWT connection method", () => {
        expect(() =>
          getConnectionAdapter(AUTHENTICATOR_TYPE.JWT, CONNECTION_METHOD.Keplr),
        ).toThrow("Unsupported JWT connection method: keplr");
      });
    });

    describe("Passkey authentication", () => {
      it("should return Passkey adapter for Passkey + Passkey", () => {
        const adapter = getConnectionAdapter(
          AUTHENTICATOR_TYPE.Passkey,
          CONNECTION_METHOD.Passkey,
        );
        expect(adapter.name).toBe("Passkey (WebAuthn)");
        expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.Passkey);
      });

      it("should throw for unsupported Passkey connection method", () => {
        expect(() =>
          getConnectionAdapter(
            AUTHENTICATOR_TYPE.Passkey,
            CONNECTION_METHOD.Stytch,
          ),
        ).toThrow("Unsupported Passkey connection method: stytch");
      });
    });

    describe("ZK-Email authentication", () => {
      it("should return ZK-Email adapter for ZKEmail + ZKEmail", () => {
        const adapter = getConnectionAdapter(
          AUTHENTICATOR_TYPE.ZKEmail,
          CONNECTION_METHOD.ZKEmail,
        );
        expect(adapter.name).toBe("ZK-Email");
        expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.ZKEmail);
      });

      it("should throw for unsupported ZKEmail connection method", () => {
        expect(() =>
          getConnectionAdapter(
            AUTHENTICATOR_TYPE.ZKEmail,
            CONNECTION_METHOD.Stytch,
          ),
        ).toThrow("Unsupported ZKEmail connection method: stytch");
      });
    });

    describe("unsupported authenticator types", () => {
      it("should throw for unknown authenticator type", () => {
        expect(() =>
          getConnectionAdapter("UnknownType" as unknown as AuthenticatorType, CONNECTION_METHOD.Keplr),
        ).toThrow(
          "Unsupported authenticator type: UnknownType with connection method: keplr",
        );
      });
    });
  });

  describe("isConnectionAvailable", () => {
    it("should return true when adapter is installed", () => {
      const available = isConnectionAvailable(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
      );
      expect(available).toBe(true);
    });

    it("should return false when adapter is not installed", () => {
      const available = isConnectionAvailable(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.OKX,
      );
      expect(available).toBe(false);
    });

    it("should return false for unsupported combination", () => {
      const available = isConnectionAvailable(
        "InvalidType" as unknown as AuthenticatorType,
        CONNECTION_METHOD.Keplr,
      );
      expect(available).toBe(false);
    });
  });

  describe("getAvailableConnections", () => {
    it("should return only installed adapters", () => {
      const connections = getAvailableConnections();

      // Should include Keplr (installed), MetaMask (installed), Stytch (installed), Passkey (installed), ZK-Email (installed)
      // Should NOT include OKX (not installed)
      expect(connections.length).toBe(5);

      const names = connections.map((c) => c.name);
      expect(names).toContain("Keplr");
      expect(names).toContain("MetaMask");
      expect(names).toContain("Stytch (Social Login)");
      expect(names).toContain("Passkey (WebAuthn)");
      expect(names).toContain("ZK-Email");
      expect(names).not.toContain("OKX Wallet");
    });

    it("should filter out null adapters from the list", () => {
      const connections = getAvailableConnections();
      expect(connections.every((c) => c !== null)).toBe(true);
    });

    it("should handle errors from adapter creation gracefully", async () => {
      // Import the mock to modify it
      const { createKeplrAdapter } =
        await import("../../connectionAdapters/adapters/Secp256k1Adapter");

      // Make Keplr adapter throw an error
      vi.mocked(createKeplrAdapter).mockImplementationOnce(() => {
        throw new Error("Adapter creation failed");
      });

      // Should still return other adapters without throwing
      const connections = getAvailableConnections();

      // Should have 4 adapters (MetaMask, Stytch, Passkey, ZK-Email) since Keplr threw an error
      // and OKX is not installed
      expect(connections.length).toBe(4);
      const names = connections.map((c) => c.name);
      expect(names).not.toContain("Keplr");
    });
  });
});
