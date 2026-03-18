import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { AAAlgo } from "@burnt-labs/signers";

// Mock the webauthn-json library
vi.mock("@github/webauthn-json/browser-ponyfill", () => ({
  get: vi.fn(),
}));

// Mock the passkey storage
vi.mock("../../../auth/passkey/passkey-storage", () => ({
  registeredCredentials: vi.fn(() => [
    { type: "public-key", id: "mock-credential-id" },
  ]),
}));

import { AAPasskeySigner } from "../../../auth/passkey/passkey-signer";
import { get } from "@github/webauthn-json/browser-ponyfill";

describe("AAPasskeySigner", () => {
  const mockAbstractAccount = "xion1testpasskeyaccount";
  const mockAuthenticatorIndex = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with abstract account and authenticator index", () => {
      const signer = new AAPasskeySigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
      );
      expect(signer).toBeDefined();
      expect(signer.abstractAccount).toBe(mockAbstractAccount);
      expect(signer.accountAuthenticatorIndex).toBe(mockAuthenticatorIndex);
    });
  });

  describe("getAccounts", () => {
    it("should return account data when abstract account exists", async () => {
      const signer = new AAPasskeySigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
      );

      const accounts = await signer.getAccounts();

      expect(accounts).toHaveLength(1);
      expect(accounts[0].address).toBe(mockAbstractAccount);
      expect(accounts[0].algo).toBe("secp256k1");
      expect(accounts[0].pubkey).toEqual(new Uint8Array());
      expect(accounts[0].authenticatorId).toBe(mockAuthenticatorIndex);
      expect(accounts[0].accountAddress).toBe(mockAbstractAccount);
      expect(accounts[0].aaalgo).toBe(AAAlgo.Passkey);
    });

    it("should return empty array when abstract account is undefined", async () => {
      const signer = new AAPasskeySigner(
        undefined as unknown as string,
        mockAuthenticatorIndex,
      );

      const accounts = await signer.getAccounts();

      expect(accounts).toHaveLength(0);
    });
  });

  describe("signDirect", () => {
    const mockSignDoc = SignDoc.fromPartial({
      bodyBytes: new Uint8Array([1, 2, 3]),
      authInfoBytes: new Uint8Array([4, 5, 6]),
      chainId: "xion-testnet-1",
      accountNumber: 123n,
    });

    it("should throw error when abstract account is not set", async () => {
      const signer = new AAPasskeySigner(
        undefined as unknown as string,
        mockAuthenticatorIndex,
      );

      await expect(
        signer.signDirect("signerAddress", mockSignDoc),
      ).rejects.toThrow("No abstract account");
    });

    it("should successfully sign with WebAuthn", async () => {
      const signer = new AAPasskeySigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
      );

      // Mock WebAuthn credential response
      const mockCredential = {
        toJSON: () => ({
          id: "mock-credential-id",
          rawId: "mock-raw-id",
          response: {
            authenticatorData: "mock-auth-data",
            clientDataJSON: "mock-client-data",
            signature: "mock-signature",
          },
          type: "public-key",
        }),
      };

      vi.mocked(get).mockResolvedValue(mockCredential);

      const response = await signer.signDirect("signerAddress", mockSignDoc);

      // Verify the response structure
      expect(response.signed).toEqual(mockSignDoc);
      expect(response.signature.pub_key.type).toBe(
        "tendermint/PubKeySecp256k1",
      );
      expect(response.signature.pub_key.value).toBe("");

      // Verify the signature is the base64 encoded JSON of the credential
      const expectedJson = JSON.stringify(mockCredential.toJSON());
      const expectedB64 = Buffer.from(
        new TextEncoder().encode(expectedJson),
      ).toString("base64");
      expect(response.signature.signature).toBe(expectedB64);
    });

    it("should pass correct options to WebAuthn get", async () => {
      const signer = new AAPasskeySigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
      );

      const mockCredential = {
        toJSON: () => ({ id: "mock-id" }),
      };
      vi.mocked(get).mockResolvedValue(mockCredential);

      await signer.signDirect("signerAddress", mockSignDoc);

      // Verify get was called with correct options
      expect(get).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.objectContaining({
            allowCredentials: [
              { type: "public-key", id: "mock-credential-id" },
            ],
            userVerification: "preferred",
          }),
        }),
      );
    });

    it("should propagate WebAuthn errors", async () => {
      const signer = new AAPasskeySigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
      );

      const webAuthnError = new Error("User cancelled the operation");
      vi.mocked(get).mockRejectedValue(webAuthnError);

      await expect(
        signer.signDirect("signerAddress", mockSignDoc),
      ).rejects.toThrow("User cancelled the operation");
    });
  });
});
