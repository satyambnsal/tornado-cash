import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  verifyEmailWithZKEmail,
  checkZKEmailStatus,
  encodeBase64Url,
  encodeBase64UrlFromBytes,
  getZKEmailStatusMessage,
  isZKEmailStatusComplete,
  isZKEmailStatusSuccess,
  isValidZKEmailFormat,
  extractEmailSalt,
  generateEmailSaltFromAccountCode,
  pollZKEmailStatusUntilComplete,
  proofResponseToBase64Signature,
  ZK_EMAIL_STATUS,
} from "../../auth/utils/zk-email";

// Configurable mock values – individual tests can override via mockConfigValues
const mockConfigValues: Record<string, unknown> = {
  ZK_EMAIL_BACKEND_URL: "https://zk-api.testnet.burnt.com",
  IS_DEV: false,
};

// Mock the config module
vi.mock("../../config", () => ({
  get ZK_EMAIL_BACKEND_URL() {
    return mockConfigValues.ZK_EMAIL_BACKEND_URL;
  },
  get IS_DEV() {
    return mockConfigValues.IS_DEV;
  },
}));

vi.mock("@burnt-labs/signers/crypto", () => ({
  toUrlSafeBase64: vi.fn((str: string) =>
    str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""),
  ),
  isValidHex: vi.fn((hex: string) => /^[0-9a-fA-F]+$/.test(hex)),
}));

/** Creates a Response-like object that provides text() for parseJsonOrText. */
function mockFetchResponse(body: unknown, ok = true) {
  const text = () => Promise.resolve(JSON.stringify(body));
  return { ok, text, json: () => Promise.resolve(body) };
}

describe("zk-email utilities", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("encodeBase64Url", () => {
    it("encodes a simple string to base64url", () => {
      const result = encodeBase64Url("hello");
      expect(result).toBe("aGVsbG8");
    });

    it("replaces + with - and / with _", () => {
      // String that produces + and / in base64
      const result = encodeBase64Url("subjects?_d");
      // Standard base64 would have + or /, base64url replaces them
      expect(result).not.toContain("+");
      expect(result).not.toContain("/");
      expect(result).not.toContain("=");
    });

    it("removes padding characters", () => {
      // "a" in base64 is "YQ==" - should become "YQ"
      const result = encodeBase64Url("a");
      expect(result).toBe("YQ");
      expect(result).not.toContain("=");
    });

    it("encodes a xion address correctly", () => {
      const xionAddress = "xion1abc123def456";
      const result = encodeBase64Url(xionAddress);
      expect(result).toBeTruthy();
      expect(result).not.toContain("+");
      expect(result).not.toContain("/");
      expect(result).not.toContain("=");
    });
  });

  describe("verifyEmailWithZKEmail", () => {
    it("sends request with turnstileToken to /command endpoint", async () => {
      const mockResponseBody = {
        success: true,
        proofId: "proof-123",
      };

      vi.mocked(global.fetch).mockResolvedValue(
        mockFetchResponse(mockResponseBody),
      );

      const result = await verifyEmailWithZKEmail(
        "test@example.com",
        "xion1abc123",
        "xion1abc123",
        "turnstile-token-xyz",
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://zk-api.testnet.burnt.com/command",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.any(String),
        }),
      );

      // Verify the body contains all required fields including turnstileToken
      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toEqual({
        email: "test@example.com",
        command: expect.any(String), // base64url encoded
        xionAddress: "xion1abc123",
        turnstileToken: "turnstile-token-xyz",
      });

      expect(result).toEqual(mockResponseBody);
    });

    it("sends command as provided (caller may pass raw or pre-encoded)", async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        mockFetchResponse({ success: true }),
      );

      await verifyEmailWithZKEmail(
        "test@example.com",
        "xion1testaddress",
        "xion1testaddress",
        "token",
      );

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Command is sent as provided (caller encodes if needed)
      expect(body.command).toBe("xion1testaddress");
    });

    it("throws error when response is not ok", async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        mockFetchResponse({ error: "Invalid turnstile token" }, false),
      );

      await expect(
        verifyEmailWithZKEmail(
          "test@example.com",
          "xion1abc123",
          "xion1abc123",
          "invalid-token",
        ),
      ).rejects.toThrow("Invalid turnstile token");
    });

    it("throws generic error when no error message in response", async () => {
      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse({}, false));

      await expect(
        verifyEmailWithZKEmail(
          "test@example.com",
          "xion1abc123",
          "xion1abc123",
          "token",
        ),
      ).rejects.toThrow("Failed to process ZK-Email verification");
    });
  });

  describe("checkZKEmailStatus", () => {
    it("fetches status for a proof ID", async () => {
      const mockStatus = {
        proofId: "proof-123",
        status: "email_sent_awaiting_reply",
      };

      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockStatus));

      const result = await checkZKEmailStatus("proof-123");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://zk-api.testnet.burnt.com/status/proof-123",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

      expect(result.proofId).toBe("proof-123");
      expect(result.status).toBe("email_sent_awaiting_reply");
    });

    it("converts publicOutputs to publicInputs in response", async () => {
      const mockStatus = {
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
          publicOutputs: ["output1", "output2"],
        },
      };

      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockStatus));

      const result = await checkZKEmailStatus("proof-123");

      expect(result.proof?.publicInputs).toEqual(["output1", "output2"]);
      expect((result.proof as unknown as Record<string, unknown>)?.publicOutputs).toBeUndefined();
    });

    it("throws error when response is not ok", async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        mockFetchResponse({ error: "Proof not found" }, false),
      );

      await expect(checkZKEmailStatus("invalid-id")).rejects.toThrow(
        "Proof not found",
      );
    });

    it("throws generic error when no error message in response", async () => {
      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse({}, false));

      await expect(checkZKEmailStatus("invalid-id")).rejects.toThrow(
        "Failed to check ZK-Email status",
      );
    });
  });

  describe("getZKEmailStatusMessage", () => {
    it("returns correct message for not_found", () => {
      expect(getZKEmailStatusMessage("not_found")).toBe(
        "Verification not found. Please try again.",
      );
    });

    it("returns correct message for initialised", () => {
      expect(getZKEmailStatusMessage("initialised")).toBe(
        "Command has been initialised and is being processed",
      );
    });

    it("returns correct message for email_sent_awaiting_reply", () => {
      expect(getZKEmailStatusMessage("email_sent_awaiting_reply")).toBe(
        "Confirmation email sent, awaiting user reply",
      );
    });

    it("returns correct message for email_replied", () => {
      expect(getZKEmailStatusMessage("email_replied")).toBe(
        "Received email reply, proof generation in progress",
      );
    });

    it("returns correct message for proof_generation_success", () => {
      expect(getZKEmailStatusMessage("proof_generation_success")).toBe(
        "Proof has been successfully generated",
      );
    });

    it("returns correct message for proof_generation_failed", () => {
      expect(getZKEmailStatusMessage("proof_generation_failed")).toBe(
        "Proof generation failed",
      );
    });

    it("returns default message for unknown status", () => {
      // Cast to ZkEmailStatus to test the default case
      expect(getZKEmailStatusMessage("unknown_status" as unknown as Parameters<typeof getZKEmailStatusMessage>[0])).toBe(
        "Processing verification...",
      );
    });
  });

  describe("isZKEmailStatusComplete", () => {
    it("returns true for proof_generation_success", () => {
      expect(isZKEmailStatusComplete("proof_generation_success")).toBe(true);
    });

    it("returns true for proof_generation_failed", () => {
      expect(isZKEmailStatusComplete("proof_generation_failed")).toBe(true);
    });

    it("returns false for email_sent_awaiting_reply", () => {
      expect(isZKEmailStatusComplete("email_sent_awaiting_reply")).toBe(false);
    });

    it("returns false for email_replied", () => {
      expect(isZKEmailStatusComplete("email_replied")).toBe(false);
    });

    it("returns false for initialised", () => {
      expect(isZKEmailStatusComplete("initialised")).toBe(false);
    });
  });

  describe("isZKEmailStatusSuccess", () => {
    it("returns true for proof_generation_success", () => {
      expect(isZKEmailStatusSuccess("proof_generation_success")).toBe(true);
    });

    it("returns false for proof_generation_failed", () => {
      expect(isZKEmailStatusSuccess("proof_generation_failed")).toBe(false);
    });

    it("returns false for email_replied", () => {
      expect(isZKEmailStatusSuccess("email_replied")).toBe(false);
    });
  });

  describe("extractEmailSalt", () => {
    it("extracts the 32nd element as email salt", () => {
      const publicInputs = new Array(69).fill("0");
      publicInputs[68] = "expected-salt-value";

      const result = extractEmailSalt(publicInputs);
      expect(result).toBe("expected-salt-value");
    });

    it("throws when publicInputs is not an array", () => {
      expect(() =>
        extractEmailSalt("not-array" as unknown as string[]),
      ).toThrow("publicInputs must be an array");
    });

    it("throws when publicInputs has too few elements", () => {
      expect(() => extractEmailSalt(new Array(10).fill("0"))).toThrow(
        "must have at least 69 elements",
      );
    });

    it("throws when email salt element is not a string", () => {
      const publicInputs = new Array(69).fill("0");
      publicInputs[68] = 42;
      expect(() =>
        extractEmailSalt(publicInputs as string[]),
      ).toThrow("must be a string");
    });
  });

  describe("encodeBase64UrlFromBytes", () => {
    it("encodes Uint8Array to base64url format", () => {
      const bytes = new TextEncoder().encode("hello");
      const result = encodeBase64UrlFromBytes(bytes);
      expect(result).toBeTruthy();
      expect(result).not.toContain("+");
      expect(result).not.toContain("/");
      expect(result).not.toContain("=");
    });

    it("produces consistent results for the same bytes", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const result1 = encodeBase64UrlFromBytes(bytes);
      const result2 = encodeBase64UrlFromBytes(bytes);
      expect(result1).toBe(result2);
    });
  });

  describe("getZkEmailBackendUrl (via verifyEmailWithZKEmail)", () => {
    it("throws when ZK_EMAIL_BACKEND_URL is not set", async () => {
      mockConfigValues.ZK_EMAIL_BACKEND_URL = "";

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("ZK_EMAIL_BACKEND_URL is not set");

      mockConfigValues.ZK_EMAIL_BACKEND_URL =
        "https://zk-api.testnet.burnt.com";
    });

    it("throws when ZK_EMAIL_BACKEND_URL is not a valid URL", async () => {
      mockConfigValues.ZK_EMAIL_BACKEND_URL = "not-a-url";

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("ZK_EMAIL_BACKEND_URL is not a valid URL");

      mockConfigValues.ZK_EMAIL_BACKEND_URL =
        "https://zk-api.testnet.burnt.com";
    });

    it("includes stringified detail when URL constructor throws a non-Error", async () => {
      // Temporarily override URL to throw a non-Error value
      const OriginalURL = globalThis.URL;
      globalThis.URL = class {
        constructor() {
          throw "non-error-string";
        }
      } as unknown as typeof URL;

      mockConfigValues.ZK_EMAIL_BACKEND_URL = "https://valid-looking.com";

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("non-error-string");

      globalThis.URL = OriginalURL;
      mockConfigValues.ZK_EMAIL_BACKEND_URL =
        "https://zk-api.testnet.burnt.com";
    });
  });

  describe("timeout callbacks", () => {
    it("verifyEmailWithZKEmail timeout callback fires abort", async () => {
      // Override setTimeout to call the callback immediately
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = ((cb: () => void) => {
        cb();
        return 0;
      }) as typeof globalThis.setTimeout;

      // fetch that rejects because signal is already aborted
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, opts: { signal?: AbortSignal }) => {
          if (opts?.signal?.aborted) {
            return Promise.reject(
              Object.assign(new Error("The operation was aborted"), {
                name: "AbortError",
              }),
            );
          }
          return Promise.resolve(mockFetchResponse({ success: true }));
        },
      );

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("Request timed out or was cancelled");

      globalThis.setTimeout = origSetTimeout;
    });

    it("checkZKEmailStatus timeout callback fires abort", async () => {
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = ((cb: () => void) => {
        cb();
        return 0;
      }) as typeof globalThis.setTimeout;

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, opts: { signal?: AbortSignal }) => {
          if (opts?.signal?.aborted) {
            return Promise.reject(
              Object.assign(new Error("The operation was aborted"), {
                name: "AbortError",
              }),
            );
          }
          return Promise.resolve(
            mockFetchResponse({ proofId: "p", status: "initialised" }),
          );
        },
      );

      await expect(checkZKEmailStatus("proof-123")).rejects.toThrow(
        "Request timed out or was cancelled",
      );

      globalThis.setTimeout = origSetTimeout;
    });

    it("generateEmailSaltFromAccountCode timeout callback fires abort", async () => {
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = ((cb: () => void) => {
        cb();
        return 0;
      }) as typeof globalThis.setTimeout;

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, opts: { signal?: AbortSignal }) => {
          if (opts?.signal?.aborted) {
            return Promise.reject(
              Object.assign(new Error("The operation was aborted"), {
                name: "AbortError",
              }),
            );
          }
          return Promise.resolve(mockFetchResponse({ emailSalt: "salt" }));
        },
      );

      await expect(
        generateEmailSaltFromAccountCode("abcdef", "test@example.com"),
      ).rejects.toThrow("Request timed out");

      globalThis.setTimeout = origSetTimeout;
    });
  });

  describe("verifyEmailWithZKEmail - additional branches", () => {
    it("handles AbortError (timeout/cancelled)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("Request timed out or was cancelled");
    });

    it("handles non-JSON error response body", async () => {
      const response = {
        ok: false,
        text: () => Promise.resolve("Not JSON at all {{{"),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("Invalid response (expected JSON)");
    });

    it("handles non-JSON success response body", async () => {
      const response = {
        ok: true,
        text: () => Promise.resolve("Not JSON at all {{{"),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("Invalid response (expected JSON)");
    });

    it("truncates long response text in parseJsonOrText error message", async () => {
      const longText = "x".repeat(300);
      const response = {
        ok: true,
        text: () => Promise.resolve(longText),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("…");
    });

    it("handles non-Error thrown by JSON.parse in parseJsonOrText", async () => {
      // Override JSON.parse to throw a non-Error value
      const originalParse = JSON.parse;
      JSON.parse = () => {
        throw "parse-non-error";
      };

      const response = {
        ok: true,
        text: () => Promise.resolve("some text"),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("parse-non-error");

      JSON.parse = originalParse;
    });

    it("logs request details in dev mode", async () => {
      mockConfigValues.IS_DEV = true;
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const response = {
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ success: true, proofId: "p1" })),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      await verifyEmailWithZKEmail(
        "test@example.com",
        "cmd",
        "xion1abc",
        "token",
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ZK-Email] Sending request to:",
        expect.any(String),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ZK-Email] Response status:",
        200,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ZK-Email] Success response:",
        expect.any(Object),
      );

      consoleSpy.mockRestore();
      mockConfigValues.IS_DEV = false;
    });

    it("handles empty text body in non-ok response", async () => {
      const response = {
        ok: false,
        status: 500,
        text: () => Promise.resolve(""),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      await expect(
        verifyEmailWithZKEmail("test@example.com", "cmd", "xion1abc", "token"),
      ).rejects.toThrow("Failed to process ZK-Email verification");
    });
  });

  describe("checkZKEmailStatus - additional branches", () => {
    it("handles AbortError (timeout/cancelled)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

      await expect(checkZKEmailStatus("proof-123")).rejects.toThrow(
        "Request timed out or was cancelled",
      );
    });

    it("handles response without publicOutputs (publicInputs already present)", async () => {
      const mockStatus = {
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
          publicInputs: ["input1", "input2"],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse(mockStatus),
      );

      const result = await checkZKEmailStatus("proof-123");
      expect(result.proof?.publicInputs).toEqual(["input1", "input2"]);
    });
  });

  describe("generateEmailSaltFromAccountCode", () => {
    it("generates email salt with valid hex account code", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ emailSalt: "12345678901234567890" }),
      );

      const result = await generateEmailSaltFromAccountCode(
        "0xabcdef",
        "test@example.com",
      );
      expect(result).toBe("12345678901234567890");

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.accountCode).toBe("abcdef");
      expect(body.emailAddress).toBe("test@example.com");
    });

    it("generates email salt with account code without 0x prefix", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ emailSalt: "salt-value" }),
      );

      const result = await generateEmailSaltFromAccountCode(
        "abcdef",
        "test@example.com",
      );
      expect(result).toBe("salt-value");
    });

    it("throws for invalid hex account code", async () => {
      await expect(
        generateEmailSaltFromAccountCode("not-hex!", "test@example.com"),
      ).rejects.toThrow("Invalid account code: must be a hexadecimal string");
    });

    it("throws for empty account code", async () => {
      await expect(
        generateEmailSaltFromAccountCode("", "test@example.com"),
      ).rejects.toThrow("Invalid account code");
    });

    it("throws for account code that is only 0x prefix", async () => {
      await expect(
        generateEmailSaltFromAccountCode("0x", "test@example.com"),
      ).rejects.toThrow("Invalid account code");
    });

    it("throws when backend returns error response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ error: "Backend validation failed" }, false),
      );

      await expect(
        generateEmailSaltFromAccountCode("abcdef", "test@example.com"),
      ).rejects.toThrow("Backend validation failed");
    });

    it("throws generic error when backend returns error without message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({}, false),
      );

      await expect(
        generateEmailSaltFromAccountCode("abcdef", "test@example.com"),
      ).rejects.toThrow("Failed to generate email salt");
    });

    it("throws when response is missing emailSalt", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ success: true }),
      );

      await expect(
        generateEmailSaltFromAccountCode("abcdef", "test@example.com"),
      ).rejects.toThrow("Invalid response: missing emailSalt");
    });

    it("throws on AbortError (timeout)", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

      await expect(
        generateEmailSaltFromAccountCode("abcdef", "test@example.com"),
      ).rejects.toThrow("Request timed out");
    });

    it("wraps unknown errors in descriptive message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network failure"),
      );

      await expect(
        generateEmailSaltFromAccountCode("abcdef", "test@example.com"),
      ).rejects.toThrow("Failed to generate email salt: Network failure");
    });

    it("wraps non-Error rejections in descriptive message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        "something weird",
      );

      await expect(
        generateEmailSaltFromAccountCode("abcdef", "test@example.com"),
      ).rejects.toThrow("Failed to generate email salt: Unknown error");
    });

    it("trims whitespace from account code", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ emailSalt: "salt" }),
      );

      await generateEmailSaltFromAccountCode("  abcdef  ", "test@example.com");

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.accountCode).toBe("abcdef");
    });
  });

  describe("pollZKEmailStatusUntilComplete", () => {
    it("returns successful terminal status with proof and calls onStatus", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({
          proofId: "proof-ok",
          status: ZK_EMAIL_STATUS.proof_generation_success,
          proof: {
            proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
            publicInputs: ["a", "b"],
          },
        }),
      );

      const onStatus = vi.fn();
      const result = await pollZKEmailStatusUntilComplete("proof-ok", {
        onStatus,
      });

      expect(result.status).toBe(ZK_EMAIL_STATUS.proof_generation_success);
      expect(onStatus).toHaveBeenCalledTimes(1);
    });

    it("throws when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        pollZKEmailStatusUntilComplete("proof-cancelled", {
          signal: controller.signal,
        }),
      ).rejects.toThrow("Polling cancelled");
    });

    it("throws timeout error when deadline has passed", async () => {
      await expect(
        pollZKEmailStatusUntilComplete("proof-timeout", {
          timeoutMs: -1,
        }),
      ).rejects.toThrow("ZK-Email proof request timed out");
    });

    it("throws status message when terminal status is failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({
          proofId: "proof-fail",
          status: ZK_EMAIL_STATUS.proof_generation_failed,
        }),
      );

      await expect(
        pollZKEmailStatusUntilComplete("proof-fail"),
      ).rejects.toThrow("Proof generation failed");
    });

    it("aborts while waiting between polls", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({
          proofId: "proof-pending",
          status: ZK_EMAIL_STATUS.initialised,
        }),
      );

      const pending = pollZKEmailStatusUntilComplete("proof-pending", {
        signal: controller.signal,
        pollIntervalMs: 1000,
      });
      pending.catch(() => {});

      controller.abort();
      await vi.runAllTimersAsync();

      await expect(pending).rejects.toThrow("Polling cancelled");
      vi.useRealTimers();
    });

    it("aborts through delay listener callback after first pending status", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({
          proofId: "proof-pending-delay-abort",
          status: ZK_EMAIL_STATUS.initialised,
        }),
      );

      const pending = pollZKEmailStatusUntilComplete(
        "proof-pending-delay-abort",
        {
          signal: controller.signal,
          pollIntervalMs: 1000,
          onStatus: () => {
            setTimeout(() => controller.abort(), 0);
          },
        },
      );
      pending.catch(() => {});

      await vi.advanceTimersByTimeAsync(0);

      await expect(pending).rejects.toThrow("Polling cancelled");
      vi.useRealTimers();
    });

    it("cancels before wait when signal is aborted by onStatus", async () => {
      const controller = new AbortController();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({
          proofId: "proof-cancel-in-onstatus",
          status: ZK_EMAIL_STATUS.initialised,
        }),
      );

      await expect(
        pollZKEmailStatusUntilComplete("proof-cancel-in-onstatus", {
          signal: controller.signal,
          onStatus: () => controller.abort(),
        }),
      ).rejects.toThrow("Polling cancelled");
    });

    it("waits and recurses to the next poll when not complete", async () => {
      vi.useFakeTimers();
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          mockFetchResponse({
            proofId: "proof-retry",
            status: ZK_EMAIL_STATUS.initialised,
          }),
        )
        .mockResolvedValueOnce(
          mockFetchResponse({
            proofId: "proof-retry",
            status: ZK_EMAIL_STATUS.proof_generation_success,
            proof: {
              proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
              publicInputs: ["x"],
            },
          }),
        );

      const pending = pollZKEmailStatusUntilComplete("proof-retry", {
        pollIntervalMs: 1000,
      });
      await vi.advanceTimersByTimeAsync(1000);

      const result = await pending;
      expect(result.status).toBe(ZK_EMAIL_STATUS.proof_generation_success);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe("proofResponseToBase64Signature", () => {
    it("throws when proof is missing", () => {
      expect(() =>
        proofResponseToBase64Signature({
          proofId: "proof-1",
          status: ZK_EMAIL_STATUS.proof_generation_success,
        } as unknown as Parameters<typeof proofResponseToBase64Signature>[0]),
      ).toThrow("proofResponseToBase64Signature: proof is required");
    });
  });

  describe("isValidZKEmailFormat", () => {
    it("returns false for non-string input", () => {
      expect(isValidZKEmailFormat(undefined as unknown as string)).toBe(false);
      expect(isValidZKEmailFormat(null as unknown as string)).toBe(false);
      expect(isValidZKEmailFormat(123 as unknown as string)).toBe(false);
    });
  });
});
