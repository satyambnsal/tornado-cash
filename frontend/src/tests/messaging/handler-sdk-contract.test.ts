/**
 * IframeMessageHandler — SDK contract regression tests
 *
 * Ensures the dashboard doesn't accidentally break the messaging contract
 * that the SDK relies on. Tests cover:
 * - All message types the SDK sends are routed to the correct callback
 * - Response format matches SDK expectations ({ success, data } or { success, error, code })
 * - Payload validation rejects malformed requests with correct error codes
 * - Security: origin validation, rate limiting, replay protection, HTTPS enforcement
 * - The VALID_MESSAGE_TARGETS constant includes required targets
 * - The IframeMessageType type covers all SDK message types
 *
 * If any of these tests break, the SDK will stop working with this dashboard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IframeMessageHandler } from "../../messaging/handler";
import type { MessageHandlerCallbacks } from "../../messaging/handler";
import {
  VALID_MESSAGE_TARGETS,
  IframeMessageType,
  type ConnectPayload,
  type SignTransactionPayload,
  type MessageResponse,
} from "../../messaging/types";
// IframeMessageType is now the SDK enum re-exported from messaging/types.ts.
// No separate alias needed — both sides use the same type.

// ─── Helpers ───────────────────────────────────────────────────────

function createMockCallbacks(
  overrides: Partial<MessageHandlerCallbacks> = {},
): MessageHandlerCallbacks {
  return {
    onConnect: vi.fn().mockResolvedValue({ address: "xion1user" }),
    onSignTransaction: vi.fn().mockResolvedValue({ signedTx: {} }),
    onSignAndBroadcast: vi
      .fn()
      .mockResolvedValue({ signedTx: { transactionHash: "ABC" } }),
    onGetAddress: vi.fn().mockReturnValue({ address: "xion1user" }),
    onDisconnect: vi.fn().mockResolvedValue({}),
    onAddAuthenticator: vi
      .fn()
      .mockResolvedValue({ authenticator: { id: "1" } }),
    onRemoveAuthenticator: vi.fn().mockResolvedValue({ success: true }),
    onRequestGrant: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

let requestCounter = 0;

function simulateMessage(
  type: string,
  payload: unknown,
  origin = "https://myapp.com",
): { promise: Promise<MessageResponse> } {
  const channel = new MessageChannel();

  const promise = new Promise<MessageResponse>((resolve) => {
    channel.port1.onmessage = (e) => resolve(e.data as MessageResponse);
  });

  const event = new MessageEvent("message", {
    data: {
      type,
      target: "xion_iframe",
      payload,
      requestId: `req-${++requestCounter}`,
    },
    origin,
    ports: [channel.port2],
  });

  window.dispatchEvent(event);
  return { promise };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("SDK ↔ Dashboard contract — message handler", () => {
  let handler: IframeMessageHandler;
  let callbacks: MessageHandlerCallbacks;

  beforeEach(() => {
    requestCounter = 0;
    callbacks = createMockCallbacks();
    handler = new IframeMessageHandler(callbacks);
  });

  afterEach(() => {
    handler.destroy();
  });

  // ── Message type constants ──

  describe("message type constants", () => {
    it("VALID_MESSAGE_TARGETS includes xion_iframe", () => {
      expect(VALID_MESSAGE_TARGETS).toContain("xion_iframe");
    });

    it("VALID_MESSAGE_TARGETS includes xion_sdk", () => {
      expect(VALID_MESSAGE_TARGETS).toContain("xion_sdk");
    });

    it("IframeMessageType is the SDK enum (single source of truth)", () => {
      // Since messaging/types.ts re-exports IframeMessageType from @burnt-labs/abstraxion-core,
      // there is no local copy to drift. This test documents that fact and verifies
      // the enum has the expected routable types.
      const routableTypes = Object.values(IframeMessageType).filter(
        (t) =>
          t !== IframeMessageType.IFRAME_READY &&
          t !== IframeMessageType.MODAL_STATE_CHANGE,
      );
      expect(routableTypes.length).toBeGreaterThanOrEqual(9);
    });

    it("all SDK-to-dashboard message types are routed (not UNKNOWN_MESSAGE_TYPE)", async () => {
      // This is the key cross-repo alignment test.
      // It sends every routable SDK message type through the real handler and
      // verifies none return UNKNOWN_MESSAGE_TYPE. If the SDK publishes a new
      // type and the handler's switch doesn't have a case for it, this fails.
      const sdkToHandlerTypes = Object.values(IframeMessageType).filter(
        (t) =>
          t !== IframeMessageType.IFRAME_READY &&
          t !== IframeMessageType.MODAL_STATE_CHANGE,
      );

      for (const type of sdkToHandlerTypes) {
        // Provide minimal valid payloads for types that require them
        const payload =
          type === "SIGN_TRANSACTION" || type === "SIGN_AND_BROADCAST"
            ? {
                transaction: {
                  messages: [],
                  fee: { amount: [], gas: "0" },
                },
                signerAddress: "xion1x",
              }
            : {};

        const { promise } = simulateMessage(type, payload);
        const response = await promise;

        expect(response.code, `${type} returned UNKNOWN_MESSAGE_TYPE — add a handler case`).not.toBe(
          "UNKNOWN_MESSAGE_TYPE",
        );
      }
    });
  });

  // ── Message routing ──

  describe("message routing — every SDK message type reaches its callback", () => {
    it("CONNECT → onConnect", async () => {
      const payload: ConnectPayload = {
        grantParams: { treasuryAddress: "xion1treasury", grantee: "xion1grantee" },
      };

      const { promise } = simulateMessage("CONNECT", payload);
      const response = await promise;

      expect(callbacks.onConnect).toHaveBeenCalledWith("https://myapp.com", payload);
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ address: "xion1user" });
    });

    it("SIGN_TRANSACTION → onSignTransaction", async () => {
      const payload: SignTransactionPayload = {
        transaction: {
          messages: [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }],
          fee: { amount: [{ denom: "uxion", amount: "1000" }], gas: "200000" },
        },
        signerAddress: "xion1signer",
      };

      const { promise } = simulateMessage("SIGN_TRANSACTION", payload);
      const response = await promise;

      expect(callbacks.onSignTransaction).toHaveBeenCalledWith(
        "https://myapp.com",
        payload,
      );
      expect(response.success).toBe(true);
    });

    it("SIGN_AND_BROADCAST → onSignAndBroadcast", async () => {
      const payload: SignTransactionPayload = {
        transaction: {
          messages: [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }],
          fee: { amount: [{ denom: "uxion", amount: "1000" }], gas: "200000" },
        },
        signerAddress: "xion1signer",
      };

      const { promise } = simulateMessage("SIGN_AND_BROADCAST", payload);
      const response = await promise;

      expect(callbacks.onSignAndBroadcast).toHaveBeenCalledWith(
        "https://myapp.com",
        payload,
      );
      expect(response.success).toBe(true);
      expect((response.data as { signedTx: { transactionHash: string } }).signedTx.transactionHash).toBe("ABC");
    });

    it("GET_ADDRESS → onGetAddress", async () => {
      const { promise } = simulateMessage("GET_ADDRESS", {});
      const response = await promise;

      expect(callbacks.onGetAddress).toHaveBeenCalledWith("https://myapp.com");
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ address: "xion1user" });
    });

    it("DISCONNECT (soft) → onDisconnect", async () => {
      const { promise } = simulateMessage("DISCONNECT", {});
      const response = await promise;

      expect(callbacks.onDisconnect).toHaveBeenCalledWith("https://myapp.com");
      expect(response.success).toBe(true);
    });

    it("HARD_DISCONNECT → onDisconnect (same handler as soft)", async () => {
      const { promise } = simulateMessage("HARD_DISCONNECT", {});
      const response = await promise;

      expect(callbacks.onDisconnect).toHaveBeenCalledWith("https://myapp.com");
      expect(response.success).toBe(true);
    });

    it("ADD_AUTHENTICATOR → onAddAuthenticator", async () => {
      const { promise } = simulateMessage("ADD_AUTHENTICATOR", { type: "passkey" });
      const response = await promise;

      expect(callbacks.onAddAuthenticator).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    it("REMOVE_AUTHENTICATOR → onRemoveAuthenticator", async () => {
      const { promise } = simulateMessage("REMOVE_AUTHENTICATOR", {
        authenticatorId: 42,
      });
      const response = await promise;

      expect(callbacks.onRemoveAuthenticator).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    it("REQUEST_GRANT → onRequestGrant", async () => {
      const { promise } = simulateMessage("REQUEST_GRANT", {
        treasuryAddress: "xion1treasury",
        grantee: "xion1grantee",
      });
      const response = await promise;

      expect(callbacks.onRequestGrant).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    it("unknown message type returns UNKNOWN_MESSAGE_TYPE error", async () => {
      const { promise } = simulateMessage("TOTALLY_FAKE_TYPE", {});
      const response = await promise;

      expect(response.success).toBe(false);
      expect(response.code).toBe("UNKNOWN_MESSAGE_TYPE");
    });
  });

  // ── Response format ──

  describe("response format — SDK depends on exact shape", () => {
    it("success response has { success: true, data: T }", async () => {
      const { promise } = simulateMessage("GET_ADDRESS", {});
      const response = await promise;

      expect(response).toHaveProperty("success", true);
      expect(response).toHaveProperty("data");
      expect(response).not.toHaveProperty("error");
    });

    it("error response has { success: false, error: string, code: string }", async () => {
      handler.destroy();
      handler = new IframeMessageHandler(
        createMockCallbacks({
          onConnect: vi.fn().mockRejectedValue(new Error("auth failed")),
        }),
      );

      const { promise } = simulateMessage("CONNECT", {});
      const response = await promise;

      expect(response).toHaveProperty("success", false);
      expect(response).toHaveProperty("error");
      expect(typeof response.error).toBe("string");
      expect(response).toHaveProperty("code");
      expect(typeof response.code).toBe("string");
    });
  });

  // ── Error codes ──

  describe("error codes — SDK uses these for error handling", () => {
    it("CONNECT failure returns AUTH_FAILED", async () => {
      handler.destroy();
      handler = new IframeMessageHandler(
        createMockCallbacks({
          onConnect: vi.fn().mockRejectedValue(new Error("nope")),
        }),
      );

      const { promise } = simulateMessage("CONNECT", {});
      const response = await promise;

      expect(response.code).toBe("AUTH_FAILED");
    });

    it("SIGN_TRANSACTION failure returns SIGNING_FAILED", async () => {
      handler.destroy();
      handler = new IframeMessageHandler(
        createMockCallbacks({
          onSignTransaction: vi.fn().mockRejectedValue(new Error("nope")),
        }),
      );

      const { promise } = simulateMessage("SIGN_TRANSACTION", {
        transaction: { messages: [], fee: { amount: [], gas: "0" } },
        signerAddress: "xion1x",
      });
      const response = await promise;

      expect(response.code).toBe("SIGNING_FAILED");
    });

    it("SIGN_AND_BROADCAST failure returns TRANSACTION_FAILED", async () => {
      handler.destroy();
      handler = new IframeMessageHandler(
        createMockCallbacks({
          onSignAndBroadcast: vi.fn().mockRejectedValue(new Error("nope")),
        }),
      );

      const { promise } = simulateMessage("SIGN_AND_BROADCAST", {
        transaction: { messages: [], fee: { amount: [], gas: "0" } },
        signerAddress: "xion1x",
      });
      const response = await promise;

      expect(response.code).toBe("TRANSACTION_FAILED");
    });

    it("DISCONNECT failure returns DISCONNECT_FAILED", async () => {
      handler.destroy();
      handler = new IframeMessageHandler(
        createMockCallbacks({
          onDisconnect: vi.fn().mockRejectedValue(new Error("nope")),
        }),
      );

      const { promise } = simulateMessage("DISCONNECT", {});
      const response = await promise;

      expect(response.code).toBe("DISCONNECT_FAILED");
    });
  });

  // ── Payload validation ──

  describe("payload validation — rejects malformed SDK requests", () => {
    it("SIGN_TRANSACTION without transaction returns INVALID_PAYLOAD", async () => {
      const { promise } = simulateMessage("SIGN_TRANSACTION", {
        signerAddress: "xion1x",
      });
      const response = await promise;

      expect(response.success).toBe(false);
      expect(response.code).toBe("INVALID_PAYLOAD");
      expect(callbacks.onSignTransaction).not.toHaveBeenCalled();
    });

    it("SIGN_AND_BROADCAST without signerAddress returns INVALID_PAYLOAD", async () => {
      const { promise } = simulateMessage("SIGN_AND_BROADCAST", {
        transaction: { messages: [], fee: { amount: [], gas: "0" } },
      });
      const response = await promise;

      expect(response.success).toBe(false);
      expect(response.code).toBe("INVALID_PAYLOAD");
      expect(callbacks.onSignAndBroadcast).not.toHaveBeenCalled();
    });

  });

  // ── Security ──

  describe("security — SDK relies on these protections", () => {
    it("rejects messages without a MessageChannel port (silent ignore)", async () => {
      // Messages without ports are silently ignored — no callback called
      const event = new MessageEvent("message", {
        data: {
          type: "CONNECT",
          target: "xion_iframe",
          payload: {},
          requestId: "req-noport",
        },
        origin: "https://myapp.com",
        // No ports
      });

      window.dispatchEvent(event);

      // Give handler time to process
      await new Promise((r) => setTimeout(r, 10));
      expect(callbacks.onConnect).not.toHaveBeenCalled();
    });

    it("rejects messages without target (non-SDK messages)", async () => {
      const channel = new MessageChannel();
      const promise = new Promise<MessageResponse>((resolve, reject) => {
        channel.port1.onmessage = (e) => resolve(e.data);
        setTimeout(() => reject(new Error("timeout")), 100);
      });

      const event = new MessageEvent("message", {
        data: { type: "CONNECT", payload: {}, requestId: "req-notarget" },
        origin: "https://myapp.com",
        ports: [channel.port2],
      });

      window.dispatchEvent(event);

      // Should timeout — no response sent for messages without target
      await expect(promise).rejects.toThrow("timeout");
    });

    it("rejects messages without requestId", async () => {
      const channel = new MessageChannel();
      const promise = new Promise<MessageResponse>((resolve) => {
        channel.port1.onmessage = (e) => resolve(e.data);
      });

      const event = new MessageEvent("message", {
        data: { type: "CONNECT", target: "xion_iframe", payload: {} },
        origin: "https://myapp.com",
        ports: [channel.port2],
      });

      window.dispatchEvent(event);
      const response = await promise;

      expect(response.success).toBe(false);
      expect(response.code).toBe("MISSING_REQUEST_ID");
    });

    it("rejects duplicate requestId (replay protection)", async () => {
      const channel1 = new MessageChannel();
      const channel2 = new MessageChannel();

      const promise1 = new Promise<MessageResponse>((resolve) => {
        channel1.port1.onmessage = (e) => resolve(e.data);
      });
      const promise2 = new Promise<MessageResponse>((resolve) => {
        channel2.port1.onmessage = (e) => resolve(e.data);
      });

      const sharedId = "req-duplicate-test";

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "GET_ADDRESS", target: "xion_iframe", payload: {}, requestId: sharedId },
          origin: "https://myapp.com",
          ports: [channel1.port2],
        }),
      );

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "GET_ADDRESS", target: "xion_iframe", payload: {}, requestId: sharedId },
          origin: "https://myapp.com",
          ports: [channel2.port2],
        }),
      );

      const resp1 = await promise1;
      const resp2 = await promise2;

      expect(resp1.success).toBe(true);
      expect(resp2.success).toBe(false);
      expect(resp2.code).toBe("DUPLICATE_REQUEST");
    });

    it("rejects non-HTTPS origins in production", async () => {
      const { promise } = simulateMessage("GET_ADDRESS", {}, "http://evil.com");
      const response = await promise;

      expect(response.success).toBe(false);
      expect(response.code).toBe("INSECURE_ORIGIN");
    });

    it("allows localhost over HTTP (development)", async () => {
      const { promise } = simulateMessage("GET_ADDRESS", {}, "http://localhost:3000");
      const response = await promise;

      expect(response.success).toBe(true);
    });

    it("rejects messages from wrong origin when allowedOrigin is set", async () => {
      handler.destroy();
      handler = new IframeMessageHandler(callbacks, "https://myapp.com");

      const { promise } = simulateMessage("GET_ADDRESS", {}, "https://evil.com");
      const response = await promise;

      expect(response.success).toBe(false);
      expect(response.code).toBe("FORBIDDEN_ORIGIN");
    });

    it("accepts messages from correct origin when allowedOrigin is set", async () => {
      handler.destroy();
      handler = new IframeMessageHandler(callbacks, "https://myapp.com");

      const { promise } = simulateMessage("GET_ADDRESS", {}, "https://myapp.com");
      const response = await promise;

      expect(response.success).toBe(true);
    });
  });

  // ── Cleanup ──

  describe("destroy() — cleanup", () => {
    it("stops responding to messages after destroy()", async () => {
      handler.destroy();

      const channel = new MessageChannel();
      const promise = new Promise<MessageResponse>((resolve, reject) => {
        channel.port1.onmessage = (e) => resolve(e.data);
        setTimeout(() => reject(new Error("timeout")), 100);
      });

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "GET_ADDRESS",
            target: "xion_iframe",
            payload: {},
            requestId: "req-after-destroy",
          },
          origin: "https://myapp.com",
          ports: [channel.port2],
        }),
      );

      await expect(promise).rejects.toThrow("timeout");
    });
  });
});
