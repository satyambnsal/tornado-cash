import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CONNECTION_METHOD } from "../../../auth/AuthStateManager";
import {
  ZKEmailAdapter,
  createZKEmailAdapter,
} from "../../../connectionAdapters/adapters/ZKEmailAdapter";

// Mock the ZK-Email signer
vi.mock("../../../auth/zk-email/zk-email-signer", () => {
  class MockAAZKEmailSigner {
    abstractAccount: string;
    accountAuthenticatorIndex: number;
    email: string;

    constructor(account: string, index: number, email: string) {
      this.abstractAccount = account;
      this.accountAuthenticatorIndex = index;
      this.email = email;
    }
  }

  return {
    AAZKEmailSigner: MockAAZKEmailSigner,
  };
});

// Mock the config module
vi.mock("../../../config", () => ({
  FEATURE_FLAGS: {
    zkemail: true,
  },
  ZK_EMAIL_BACKEND_URL: "https://zk-api.testnet.burnt.com",
}));

describe("ZKEmailAdapter", () => {
  let adapter: ZKEmailAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ZKEmailAdapter();
  });

  describe("static properties", () => {
    it("should have correct authenticator type", () => {
      expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.ZKEmail);
    });

    it("should have correct connection method", () => {
      expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.ZKEmail);
    });

    it("should have correct name", () => {
      expect(adapter.name).toBe("ZK-Email");
    });
  });

  describe("isInstalled", () => {
    it("should return true when feature flag is enabled", () => {
      expect(adapter.isInstalled()).toBe(true);
    });
  });

  describe("enable", () => {
    it("should be a no-op and resolve without error", async () => {
      await expect(adapter.enable("xion-testnet-1")).resolves.toBeUndefined();
    });

    it("should accept any chainId", async () => {
      await expect(adapter.enable("xion-mainnet-1")).resolves.toBeUndefined();
      await expect(adapter.enable("")).resolves.toBeUndefined();
    });
  });

  describe("getSigner", () => {
    it("should return AAZKEmailSigner instance", () => {
      const abstractAccount = "xion1zkemailaccount";
      const authenticatorIndex = 2;
      const email = "user@example.com";

      const signer = adapter.getSigner(
        abstractAccount,
        authenticatorIndex,
        email,
      );

      expect(signer).toBeDefined();
      expect(signer.abstractAccount).toBe(abstractAccount);
      expect(signer.accountAuthenticatorIndex).toBe(authenticatorIndex);
      expect(signer.email).toBe(email);
    });

    it("should work with different parameters", () => {
      const signer = adapter.getSigner(
        "xion1different",
        5,
        "different@example.com",
      );

      expect(signer).toBeDefined();
      expect(signer.email).toBe("different@example.com");
    });
  });

  describe("createZKEmailAdapter factory", () => {
    it("should create a new ZKEmailAdapter instance", () => {
      const adapter = createZKEmailAdapter();
      expect(adapter).toBeInstanceOf(ZKEmailAdapter);
    });
  });
});

describe("ZKEmailAdapter with feature flag disabled", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should return false when feature flag is disabled", async () => {
    // Re-mock with feature flag disabled
    vi.doMock("../../../config", () => ({
      FEATURE_FLAGS: {
        zkemail: false,
      },
    }));

    // Re-import to get fresh module with new mock
    const { ZKEmailAdapter } =
      await import("../../../connectionAdapters/adapters/ZKEmailAdapter");
    const adapter = new ZKEmailAdapter();

    expect(adapter.isInstalled()).toBe(false);
  });

  it("should throw from enable when feature flag is disabled", async () => {
    vi.doMock("../../../config", () => ({
      FEATURE_FLAGS: {
        zkemail: false,
      },
    }));

    const { ZKEmailAdapter } =
      await import("../../../connectionAdapters/adapters/ZKEmailAdapter");
    const adapter = new ZKEmailAdapter();

    await expect(adapter.enable("xion-testnet-2")).rejects.toThrow(
      "ZK-Email is not supported in this browser",
    );
  });
});
