import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CONNECTION_METHOD } from "../../../auth/AuthStateManager";
import {
  JWTAdapter,
  createJWTAdapter,
} from "../../../connectionAdapters/adapters/JWTAdapter";

// Mock the JWT signer - class must be defined inside factory due to hoisting
vi.mock("../../../auth/jwt/jwt-signer", () => {
  class MockAbstractAccountJWTSigner {
    abstractAccount: string;
    accountAuthenticatorIndex: number;
    sessionToken: string;
    apiUrl: string;

    constructor(account: string, index: number, token: string, url: string) {
      this.abstractAccount = account;
      this.accountAuthenticatorIndex = index;
      this.sessionToken = token;
      this.apiUrl = url;
    }
  }

  return {
    AbstractAccountJWTSigner: MockAbstractAccountJWTSigner,
  };
});

describe("JWTAdapter", () => {
  let adapter: JWTAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new JWTAdapter();
  });

  describe("static properties", () => {
    it("should have correct authenticator type", () => {
      expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.JWT);
    });

    it("should have correct connection method", () => {
      expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.Stytch);
    });

    it("should have correct name", () => {
      expect(adapter.name).toBe("Stytch (Social Login)");
    });
  });

  describe("isInstalled", () => {
    it("should always return true since JWT is a service", () => {
      expect(adapter.isInstalled()).toBe(true);
    });
  });

  describe("enable", () => {
    it("should be a no-op and resolve without error", async () => {
      // enable is a no-op for JWT, should just resolve
      await expect(adapter.enable("xion-testnet-1")).resolves.toBeUndefined();
    });

    it("should accept any chainId", async () => {
      await expect(adapter.enable("xion-mainnet-1")).resolves.toBeUndefined();
      await expect(adapter.enable("")).resolves.toBeUndefined();
    });
  });

  describe("getSigner", () => {
    it("should return AbstractAccountJWTSigner instance", () => {
      const abstractAccount = "xion1jwtaccount";
      const authenticatorIndex = 3;
      const sessionToken = "test-session-token";
      const apiUrl = "https://api.stytch.com/v1";

      const signer = adapter.getSigner(
        abstractAccount,
        authenticatorIndex,
        sessionToken,
        apiUrl,
      );

      // Verify signer has expected properties from AbstractAccountJWTSigner
      expect(signer).toBeDefined();
      expect(signer.abstractAccount).toBe(abstractAccount);
      expect(signer.accountAuthenticatorIndex).toBe(authenticatorIndex);
      expect(signer.sessionToken).toBe(sessionToken);
      expect(signer.apiUrl).toBe(apiUrl);
    });

    it("should work with different parameters", () => {
      const signer = adapter.getSigner(
        "xion1different",
        5,
        "different-token",
        "https://different-api.com",
      );

      // Verify signer has expected properties
      expect(signer).toBeDefined();
      expect(signer.sessionToken).toBe("different-token");
    });
  });

  describe("createJWTAdapter factory", () => {
    it("should create a new JWTAdapter instance", () => {
      const adapter = createJWTAdapter();
      expect(adapter).toBeInstanceOf(JWTAdapter);
    });
  });
});
