import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { AAAlgo } from "@burnt-labs/signers";

// Mock dependencies before importing the class
vi.mock("../../../auth/utils/zk-email", () => ({
  verifyEmailWithZKEmail: vi.fn(),
  checkZkEmailStatus: vi.fn(),
  pollZKEmailStatusUntilComplete: vi.fn(),
  isZkEmailStatusComplete: vi.fn(),
  isZkEmailStatusSuccess: vi.fn(),
  getZKEmailStatusMessage: vi.fn((status: string) => `Status: ${status}`),
  ZK_EMAIL_STATUS: {
    email_sent_awaiting_reply: "email_sent_awaiting_reply",
    email_replied: "email_replied",
    proof_generation_success: "proof_generation_success",
    proof_generation_failed: "proof_generation_failed",
    not_found: "not_found",
    initialised: "initialised",
  },
  ZK_EMAIL_POLL_INTERVAL_MS: 3000,
  ZK_EMAIL_PROOF_TIMEOUT_MS: 300000,
}));

vi.mock("../../../auth/zk-email/zk-email-signing-status", () => ({
  setZKEmailSigningStatus: vi.fn(),
  getZKEmailSigningAbortController: vi.fn(() => null),
  getZKEmailTurnstileTokenProvider: vi.fn(function (this: void) {
    return () => Promise.resolve("mock-turnstile-token");
  }),
}));

vi.mock("@burnt-labs/signers/crypto", () => ({
  toUrlSafeBase64: vi.fn((str: string) => `base64_${str}`),
}));

vi.mock("@cosmjs/proto-signing", () => ({
  makeSignBytes: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
}));

import { AAZKEmailSigner } from "../../../auth/zk-email/zk-email-signer";
import {
  verifyEmailWithZKEmail,
  pollZKEmailStatusUntilComplete,
} from "../../../auth/utils/zk-email";
import type {
  ZKEmailStatusResponse,
  ZKProof,
} from "../../../auth/utils/zk-email";
import {
  setZKEmailSigningStatus,
  getZKEmailSigningAbortController,
  getZKEmailTurnstileTokenProvider,
} from "../../../auth/zk-email/zk-email-signing-status";

describe("AAZKEmailSigner", () => {
  const mockAbstractAccount = "xion1testaccount123";
  const mockAuthenticatorIndex = 1;
  const mockEmail = "test@example.com";

  let signer: AAZKEmailSigner;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(getZKEmailTurnstileTokenProvider).mockReturnValue(
      () => Promise.resolve("mock-turnstile-token"),
    );
    // So signDirect proceeds to poll; otherwise it throws "Polling cancelled" before calling pollZKEmailStatusUntilComplete
    vi.mocked(getZKEmailSigningAbortController).mockReturnValue(
      new AbortController(),
    );
    signer = new AAZKEmailSigner(
      mockAbstractAccount,
      mockAuthenticatorIndex,
      mockEmail,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create signer with correct properties", () => {
      expect(signer.abstractAccount).toBe(mockAbstractAccount);
      expect(signer.accountAuthenticatorIndex).toBe(mockAuthenticatorIndex);
      expect(signer.email).toBe(mockEmail);
    });

    it("should handle empty email", () => {
      const signerWithEmptyEmail = new AAZKEmailSigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
        "",
      );
      expect(signerWithEmptyEmail.email).toBe("");
    });
  });

  describe("getAccounts", () => {
    it("should return account data with correct properties", async () => {
      const accounts = await signer.getAccounts();

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        address: mockAbstractAccount,
        algo: "secp256k1",
        pubkey: new Uint8Array(),
        authenticatorId: mockAuthenticatorIndex,
        accountAddress: mockAbstractAccount,
        aaalgo: AAAlgo.ZKEmail,
      });
    });

    it("should return empty array when no abstract account", async () => {
      const signerWithoutAccount = new AAZKEmailSigner(
        undefined as unknown as string,
        mockAuthenticatorIndex,
        mockEmail,
      );

      const accounts = await signerWithoutAccount.getAccounts();
      expect(accounts).toHaveLength(0);
    });
  });

  describe("signDirect", () => {
    const mockSignDoc: SignDoc = {
      bodyBytes: new Uint8Array([1, 2, 3]),
      authInfoBytes: new Uint8Array([4, 5, 6]),
      chainId: "xion-testnet-1",
      accountNumber: BigInt(123),
    };

    it("should throw error when abstract account is missing", async () => {
      const signerWithoutAccount = new AAZKEmailSigner(
        "",
        mockAuthenticatorIndex,
        mockEmail,
      );

      await expect(
        signerWithoutAccount.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("abstract account is required");
    });

    it("should throw error when email is missing", async () => {
      const signerWithoutEmail = new AAZKEmailSigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
        "",
      );

      await expect(
        signerWithoutEmail.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("email is required");
    });

    it("should throw error when email is only whitespace", async () => {
      const signerWithWhitespaceEmail = new AAZKEmailSigner(
        mockAbstractAccount,
        mockAuthenticatorIndex,
        "   ",
      );

      await expect(
        signerWithWhitespaceEmail.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("email is required");
    });

    it("should set status and throw when turnstile provider is missing", async () => {
      vi.mocked(getZKEmailTurnstileTokenProvider).mockReturnValue(null);

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("requires Turnstile token");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith({
        phase: "error",
        message: "Security verification is required. Please try again.",
      });
    });

    it("should handle non-Error turnstile provider failure", async () => {
      vi.mocked(getZKEmailTurnstileTokenProvider).mockReturnValue(
        () => Promise.reject("provider failed"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Failed to complete security verification.");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith({
        phase: "error",
        message: "Failed to complete security verification.",
      });
    });

    it("should preserve Error message when turnstile provider rejects with Error", async () => {
      vi.mocked(getZKEmailTurnstileTokenProvider).mockReturnValue(
        () => Promise.reject(new Error("turnstile explode")),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("turnstile explode");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith({
        phase: "error",
        message: "turnstile explode",
      });
    });

    it("should fail when turnstile token provider is missing", async () => {
      vi.mocked(getZKEmailTurnstileTokenProvider).mockReturnValue(null);

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("requires Turnstile token");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith({
        phase: "error",
        message: "Security verification is required. Please try again.",
      });
    });

    it("should map non-Error turnstile provider failure to fallback message", async () => {
      vi.mocked(getZKEmailTurnstileTokenProvider).mockReturnValue(() =>
        Promise.reject("bad-token-flow"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Failed to complete security verification.");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith({
        phase: "error",
        message: "Failed to complete security verification.",
      });
    });

    it("should throw error when verification fails", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: false,
        error: "Backend error",
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Backend error");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith({
        phase: "error",
        message: "Backend error",
      });
    });

    it("should throw error when proofId is missing", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: undefined,
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Failed to send ZK-Email verification");
    });

    it("should successfully sign when proof is ready", async () => {
      const mockProofId = "proof-123";
      const mockProof = {
        pi_a: ["1", "2", "3"],
        pi_b: [
          ["4", "5"],
          ["6", "7"],
          ["8", "9"],
        ],
        pi_c: ["10", "11", "12"],
        protocol: "groth16",
      };
      const mockPublicInputs = ["input1", "input2"];

      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: mockProofId,
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: mockProofId,
        status: "proof_generation_success",
        proof: {
          proof: mockProof,
          publicInputs: mockPublicInputs,
        },
      } as unknown as ZKEmailStatusResponse);

      const result = await signer.signDirect(mockAbstractAccount, mockSignDoc);

      expect(result.signed).toBe(mockSignDoc);
      expect(result.signature.signature).toBeDefined();
      expect(() =>
        Buffer.from(result.signature.signature, "base64"),
      ).not.toThrow();
    });

    it("should poll until proof is ready", async () => {
      const mockProofId = "proof-123";
      const mockProof = {
        pi_a: ["1", "2"],
        pi_b: [
          ["3", "4"],
          ["5", "6"],
          ["7", "8"],
        ],
        pi_c: ["9", "10"],
      };

      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: mockProofId,
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: mockProofId,
        status: "proof_generation_success",
        proof: {
          proof: mockProof,
          publicInputs: ["pub1"],
        },
      } as unknown as ZKEmailStatusResponse);

      const result = await signer.signDirect(mockAbstractAccount, mockSignDoc);

      expect(pollZKEmailStatusUntilComplete).toHaveBeenCalledWith(
        mockProofId,
        expect.any(Object),
      );
      expect(result.signature.signature).toBeDefined();
    });

    it("should handle abort signal", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Signing cancelled"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Signing cancelled");
    });

    it("should clear status when polling is cancelled", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Polling cancelled"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Polling cancelled");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith(null);
    });

    it("should timeout after 5 minutes", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("zk-email proof request timed out"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("timed out");
    });

    it("should handle proof with error status", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Proof generation failed"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow();
    });

    it("should clear status on polling cancelled", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Polling cancelled"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Polling cancelled");

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith(null);
    });
  });

  describe("buildDirectSignResponse validation", () => {
    const mockSignDoc: SignDoc = {
      bodyBytes: new Uint8Array([1]),
      authInfoBytes: new Uint8Array([2]),
      chainId: "xion-testnet-1",
      accountNumber: BigInt(1),
    };

    beforeEach(() => {
      // Need non-null controller so signDirect proceeds to poll and then buildDirectSignResponse
      vi.mocked(getZKEmailSigningAbortController).mockReturnValue(
        new AbortController(),
      );
    });

    it("should reject invalid proof format - missing pi_a", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_b: [
              ["1", "2"],
              ["3", "4"],
              ["5", "6"],
            ],
            pi_c: ["7", "8"],
          },
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("pi_a must be a non-empty array");
    });

    it("should reject invalid proof format - pi_b wrong structure", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_a: ["1", "2"],
            pi_b: [["1", "2"]], // Should have 3 elements
            pi_c: ["7", "8"],
          },
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("pi_b must be an array of 3 elements");
    });

    it("should reject invalid publicInputs format", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_a: ["1", "2"],
            pi_b: [
              ["1", "2"],
              ["3", "4"],
              ["5", "6"],
            ],
            pi_c: ["7", "8"],
          },
          publicInputs: "not-an-array",
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("publicInputs must be a JSON array");
    });

    it("should reject when pi_a contains non-strings", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_a: [1, 2],
            pi_b: [
              ["1", "2"],
              ["3", "4"],
              ["5", "6"],
            ],
            pi_c: ["7", "8"],
          },
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("pi_a must contain only strings");
    });

    it("should reject when pi_b row has wrong element types", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_a: ["1", "2"],
            pi_b: [
              ["1", "2"],
              ["3", 4],
              ["5", "6"],
            ],
            pi_c: ["7", "8"],
          },
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("pi_b[1] must be an array of 2 strings");
    });

    it("should reject when pi_c is empty", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_a: ["1", "2"],
            pi_b: [
              ["1", "2"],
              ["3", "4"],
              ["5", "6"],
            ],
            pi_c: [],
          },
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("pi_c must be a non-empty array");
    });

    it("should reject when pi_c contains non-strings", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_a: ["1", "2"],
            pi_b: [
              ["1", "2"],
              ["3", "4"],
              ["5", "6"],
            ],
            pi_c: [7, 8],
          },
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("pi_c must contain only strings");
    });

    it("should reject when publicInputs contains non-strings", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {
            pi_a: ["1", "2"],
            pi_b: [
              ["1", "2"],
              ["3", "4"],
              ["5", "6"],
            ],
            pi_c: ["7", "8"],
          },
          publicInputs: [1, 2],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("publicInputs must contain only strings");
    });

    it("should reject empty proof string", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: {} as unknown as ZKProof,
          publicInputs: [],
        },
      });

      // Mock so that proof string becomes empty

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("pi_a must be a non-empty array");
    });

    it("should handle poll error that is not abort-related", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Status API down"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Status API down");
    });

    it("should abort during initial signal check before polling starts", async () => {
      vi.mocked(getZKEmailSigningAbortController).mockReturnValue(null);
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Polling cancelled");
    });

    it("should handle abort during status check", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Signing cancelled"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Signing cancelled");
    });

    it("should set status detail for email_replied status", async () => {
      const mockProof = {
        pi_a: ["1"],
        pi_b: [
          ["2", "3"],
          ["4", "5"],
          ["6", "7"],
        ],
        pi_c: ["8"],
      };
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      vi.mocked(pollZKEmailStatusUntilComplete).mockImplementation(
        async (_proofId, options) => {
          options?.onStatus?.({
            proofId: "proof-123",
            status: "email_replied",
          } as unknown as ZKEmailStatusResponse);
          return {
            proofId: "proof-123",
            status: "proof_generation_success" as const,
            proof: { proof: mockProof, publicInputs: ["pub1"] },
          } as unknown as ZKEmailStatusResponse;
        },
      );

      await signer.signDirect(mockAbstractAccount, mockSignDoc);

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: "in_progress",
          detail:
            "Generating zero-knowledge proof. This may take 10-30 seconds.",
        }),
      );
    });

    it("omits progress detail for non-email_replied status updates", async () => {
      const mockProof = {
        pi_a: ["1"],
        pi_b: [
          ["2", "3"],
          ["4", "5"],
          ["6", "7"],
        ],
        pi_c: ["8"],
      };
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      vi.mocked(pollZKEmailStatusUntilComplete).mockImplementation(
        async (_proofId, options) => {
          options?.onStatus?.({
            proofId: "proof-123",
            status: "email_sent_awaiting_reply",
          } as unknown as ZKEmailStatusResponse);
          return {
            proofId: "proof-123",
            status: "proof_generation_success" as const,
            proof: { proof: mockProof, publicInputs: ["pub1"] },
          } as unknown as ZKEmailStatusResponse;
        },
      );

      await signer.signDirect(mockAbstractAccount, mockSignDoc);

      expect(setZKEmailSigningStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: "in_progress",
          detail: undefined,
        }),
      );
    });

    it("should cancel when signal aborted between poll scheduling and execution", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Signing cancelled"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Signing cancelled");
    });

    it("should handle settled guard in error/complete branch", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Status: error"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Status: error");
    });

    it("should cancel when signal aborted after non-complete status check", async () => {
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
        new Error("Signing cancelled"),
      );

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Signing cancelled");
    });

    it("should reject when proof data is undefined in status response", async () => {
      // Covers L225: !proofTrimmed || !publicInputsTrimmed check in buildDirectSignResponse
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success" as const,
        proof: {
          proof: undefined as unknown as ZKProof, // JSON.stringify(undefined) => undefined
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow(
        "proof and publicInputs are required and must be non-empty",
      );
    });

    it("should reject when proof is not a JSON object (e.g. a string)", async () => {
      // Covers L255: proofData not-an-object check
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success" as const,
        proof: {
          proof: "not-an-object" as unknown as ZKProof, // JSON.stringify("x") => '"x"', JSON.parse('"x"') => "x"
          publicInputs: ["pub1"],
        },
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("proof must be a JSON object");
    });

    it("should handle JSON parse error in buildDirectSignResponse", async () => {
      // Covers L246-248: JSON parse catch in buildDirectSignResponse
      // We need proofStr/publicInputsStr to be non-empty but invalid JSON.
      // Override JSON.stringify to return invalid JSON for the proof object.
      const origStringify = JSON.stringify;
      let callCount = 0;
      vi.spyOn(JSON, "stringify").mockImplementation(
        (...args: Parameters<typeof JSON.stringify>) => {
          callCount++;
          // The proof and publicInputs stringify calls happen inside pollForProof resolve
          // Call sequence: proof (first), publicInputs (second)
          if (callCount === 1) {
            return "{invalid-json"; // Return non-empty but unparseable string for proof
          }
          return origStringify.apply(JSON, args);
        },
      );

      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success" as const,
        proof: {
          proof: {
            pi_a: ["1"],
            pi_b: [
              ["2", "3"],
              ["4", "5"],
              ["6", "7"],
            ],
            pi_c: ["8"],
          },
          publicInputs: ["pub1"],
        },
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("proof and publicInputs must be valid JSON");

      consoleErrorSpy.mockRestore();
      vi.mocked(JSON.stringify).mockRestore();
    });

    it("should handle non-Error thrown by JSON.parse in buildDirectSignResponse", async () => {
      // Covers L246: false branch of parseErr instanceof Error
      vi.spyOn(JSON, "parse").mockImplementation(() => {
        throw "parse-non-error";
      });

      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success" as const,
        proof: {
          proof: {
            pi_a: ["1"],
            pi_b: [
              ["2", "3"],
              ["4", "5"],
              ["6", "7"],
            ],
            pi_c: ["8"],
          },
          publicInputs: ["pub1"],
        },
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow(
        "proof and publicInputs must be valid JSON. parse-non-error",
      );

      consoleErrorSpy.mockRestore();
      vi.mocked(JSON.parse).mockRestore();
    });

    it("should handle non-Error thrown by signDirect pollForProof", async () => {
      // Covers L96: false branch of `err instanceof Error`
      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      // Make checkZkEmailStatus throw a non-Error
      vi.mocked(pollZKEmailStatusUntilComplete).mockImplementation(async () => {
        throw "non-error-string";
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toBe("non-error-string");

      // Verify the error status was set with the fallback message
      expect(setZKEmailSigningStatus).toHaveBeenCalledWith({
        phase: "error",
        message: "Signing failed. Please try again.",
      });
    });

    it("should cancel when signal aborted in catch block", async () => {
      // Covers catch block: signer rethrows whatever poll threw
      const abortController = new AbortController();
      vi.mocked(getZKEmailSigningAbortController).mockReturnValue(
        abortController,
      );

      vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      vi.mocked(pollZKEmailStatusUntilComplete).mockImplementation(async () => {
        abortController.abort();
        throw new Error("Network error during abort");
      });

      await expect(
        signer.signDirect(mockAbstractAccount, mockSignDoc),
      ).rejects.toThrow("Network error during abort");
    });
  });
});
