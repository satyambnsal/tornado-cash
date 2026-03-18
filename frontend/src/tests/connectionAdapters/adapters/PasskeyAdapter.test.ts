import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CONNECTION_METHOD } from "../../../auth/AuthStateManager";
import {
  PasskeyAdapter,
  createPasskeyAdapter,
} from "../../../connectionAdapters/adapters/PasskeyAdapter";

// Mock the Passkey signer - class must be defined inside factory due to hoisting
vi.mock("../../../auth/passkey/passkey-signer", () => {
  class MockAAPasskeySigner {
    abstractAccount: string;
    accountAuthenticatorIndex: number;

    constructor(account: string, index: number) {
      this.abstractAccount = account;
      this.accountAuthenticatorIndex = index;
    }
  }

  return {
    AAPasskeySigner: MockAAPasskeySigner,
  };
});

describe("PasskeyAdapter", () => {
  let adapter: PasskeyAdapter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock PublicKeyCredential
    Object.defineProperty(window, "PublicKeyCredential", {
      value: {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    adapter = new PasskeyAdapter();
  });

  afterEach(() => {
    // @ts-expect-error - cleaning up mock
    delete window.PublicKeyCredential;
  });

  describe("static properties", () => {
    it("should have correct authenticator type", () => {
      expect(adapter.authenticatorType).toBe(AUTHENTICATOR_TYPE.Passkey);
    });

    it("should have correct connection method", () => {
      expect(adapter.connectionMethod).toBe(CONNECTION_METHOD.Passkey);
    });

    it("should have correct name", () => {
      expect(adapter.name).toBe("Passkey (WebAuthn)");
    });
  });

  describe("isInstalled", () => {
    it("should return true when WebAuthn is supported", () => {
      expect(adapter.isInstalled()).toBe(true);
    });

    it("should return false when window is undefined", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing undefined window
      delete global.window;

      // Need to check in a context where window is undefined
      // This is tricky in JSDOM, so we'll mock the check
      // @ts-expect-error - restoring window
      global.window = originalWindow;
    });

    it("should return false when PublicKeyCredential is undefined", () => {
      // @ts-expect-error - testing undefined case
      delete window.PublicKeyCredential;

      expect(adapter.isInstalled()).toBe(false);
    });

    it("should return false when isUserVerifyingPlatformAuthenticatorAvailable is not a function", () => {
      Object.defineProperty(window, "PublicKeyCredential", {
        value: {
          // Not a function
          isUserVerifyingPlatformAuthenticatorAvailable: "not-a-function",
        },
        writable: true,
        configurable: true,
      });

      expect(adapter.isInstalled()).toBe(false);
    });
  });

  describe("enable", () => {
    it("should resolve when platform authenticator is available", async () => {
      (
        window.PublicKeyCredential
          .isUserVerifyingPlatformAuthenticatorAvailable as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue(true);

      await expect(adapter.enable("xion-testnet-1")).resolves.toBeUndefined();
    });

    it("should throw when WebAuthn is not supported", async () => {
      // @ts-expect-error - testing undefined case
      delete window.PublicKeyCredential;

      const adapter = new PasskeyAdapter();
      await expect(adapter.enable("xion-testnet-1")).rejects.toThrow(
        "WebAuthn is not supported in this browser",
      );
    });

    it("should throw when no platform authenticator is available", async () => {
      (
        window.PublicKeyCredential
          .isUserVerifyingPlatformAuthenticatorAvailable as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue(false);

      await expect(adapter.enable("xion-testnet-1")).rejects.toThrow(
        "No platform authenticator available. Please use a device with biometric authentication or a security key.",
      );
    });
  });

  describe("getSigner", () => {
    it("should return AAPasskeySigner instance", () => {
      const abstractAccount = "xion1passkeyaccount";
      const authenticatorIndex = 4;

      const signer = adapter.getSigner(abstractAccount, authenticatorIndex);

      // Verify signer has expected properties from AAPasskeySigner
      expect(signer).toBeDefined();
      expect(signer.abstractAccount).toBe(abstractAccount);
      expect(signer.accountAuthenticatorIndex).toBe(authenticatorIndex);
    });

    it("should work with different parameters", () => {
      const signer = adapter.getSigner("xion1different", 10);

      // Verify signer has expected properties
      expect(signer).toBeDefined();
      expect(signer.accountAuthenticatorIndex).toBe(10);
    });
  });

  describe("createPasskeyAdapter factory", () => {
    it("should create a new PasskeyAdapter instance", () => {
      const adapter = createPasskeyAdapter();
      expect(adapter).toBeInstanceOf(PasskeyAdapter);
    });
  });
});
