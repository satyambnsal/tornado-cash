import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setZKEmailSigningStatus,
  getZKEmailSigningStatus,
  subscribeZKEmailSigningStatus,
  setZKEmailSigningAbortController,
  getZKEmailSigningAbortController,
  setZKEmailProofPollingAbortController,
  getZKEmailProofPollingAbortController,
  setZKEmailTurnstileTokenProvider,
  getZKEmailTurnstileTokenProvider,
  ZKEmailSigningStatus,
} from "../../../auth/zk-email/zk-email-signing-status";

describe("zk-email-signing-status", () => {
  beforeEach(() => {
    // Reset state between tests
    setZKEmailSigningStatus(null);
    setZKEmailSigningAbortController(null);
    setZKEmailProofPollingAbortController(null);
    setZKEmailTurnstileTokenProvider(null);
  });

  describe("signing status", () => {
    it("should start with null status", () => {
      expect(getZKEmailSigningStatus()).toBeNull();
    });

    it("should set and get status", () => {
      const status: ZKEmailSigningStatus = {
        phase: "in_progress",
        message: "Sending verification email...",
      };

      setZKEmailSigningStatus(status);
      expect(getZKEmailSigningStatus()).toEqual(status);
    });

    it("should set status with detail", () => {
      const status: ZKEmailSigningStatus = {
        phase: "in_progress",
        message: "Generating proof",
        detail: "This may take 10-30 seconds",
      };

      setZKEmailSigningStatus(status);
      const result = getZKEmailSigningStatus();
      expect(result?.detail).toBe("This may take 10-30 seconds");
    });

    it("should clear status when set to null", () => {
      setZKEmailSigningStatus({
        phase: "success",
        message: "Done!",
      });
      expect(getZKEmailSigningStatus()).not.toBeNull();

      setZKEmailSigningStatus(null);
      expect(getZKEmailSigningStatus()).toBeNull();
    });

    it("should handle error phase", () => {
      const errorStatus: ZKEmailSigningStatus = {
        phase: "error",
        message: "Failed to send email",
      };

      setZKEmailSigningStatus(errorStatus);
      expect(getZKEmailSigningStatus()?.phase).toBe("error");
    });

    it("should handle success phase", () => {
      const successStatus: ZKEmailSigningStatus = {
        phase: "success",
        message: "Proof generated successfully!",
      };

      setZKEmailSigningStatus(successStatus);
      expect(getZKEmailSigningStatus()?.phase).toBe("success");
    });
  });

  describe("subscribeZKEmailSigningStatus", () => {
    it("should call listener immediately with current status", () => {
      const initialStatus: ZKEmailSigningStatus = {
        phase: "in_progress",
        message: "Working...",
      };
      setZKEmailSigningStatus(initialStatus);

      const listener = vi.fn();
      subscribeZKEmailSigningStatus(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(initialStatus);
    });

    it("should call listener with null when no status set", () => {
      const listener = vi.fn();
      subscribeZKEmailSigningStatus(listener);

      expect(listener).toHaveBeenCalledWith(null);
    });

    it("should notify listener on status change", () => {
      const listener = vi.fn();
      subscribeZKEmailSigningStatus(listener);

      const newStatus: ZKEmailSigningStatus = {
        phase: "success",
        message: "Complete!",
      };
      setZKEmailSigningStatus(newStatus);

      // Called twice: once on subscribe, once on change
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(newStatus);
    });

    it("should notify multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      subscribeZKEmailSigningStatus(listener1);
      subscribeZKEmailSigningStatus(listener2);

      const status: ZKEmailSigningStatus = {
        phase: "in_progress",
        message: "Processing...",
      };
      setZKEmailSigningStatus(status);

      expect(listener1).toHaveBeenLastCalledWith(status);
      expect(listener2).toHaveBeenLastCalledWith(status);
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeZKEmailSigningStatus(listener);

      // Initial call
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      // After unsubscribe, listener should not be called
      setZKEmailSigningStatus({
        phase: "success",
        message: "Done",
      });

      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should handle multiple subscribe/unsubscribe cycles", () => {
      const listener = vi.fn();

      const unsub1 = subscribeZKEmailSigningStatus(listener);
      unsub1();

      const unsub2 = subscribeZKEmailSigningStatus(listener);
      setZKEmailSigningStatus({ phase: "in_progress", message: "Test" });

      expect(listener).toHaveBeenCalledTimes(3); // Initial + re-subscribe initial + update
      unsub2();
    });
  });

  describe("signing abort controller", () => {
    it("should start with null controller", () => {
      expect(getZKEmailSigningAbortController()).toBeNull();
    });

    it("should set and get abort controller", () => {
      const controller = new AbortController();
      setZKEmailSigningAbortController(controller);

      expect(getZKEmailSigningAbortController()).toBe(controller);
    });

    it("should clear abort controller", () => {
      const controller = new AbortController();
      setZKEmailSigningAbortController(controller);
      setZKEmailSigningAbortController(null);

      expect(getZKEmailSigningAbortController()).toBeNull();
    });

    it("should allow aborting the controller", () => {
      const controller = new AbortController();
      setZKEmailSigningAbortController(controller);

      expect(controller.signal.aborted).toBe(false);
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe("proof polling abort controller", () => {
    it("should start with null controller", () => {
      expect(getZKEmailProofPollingAbortController()).toBeNull();
    });

    it("should set and get abort controller", () => {
      const controller = new AbortController();
      setZKEmailProofPollingAbortController(controller);

      expect(getZKEmailProofPollingAbortController()).toBe(controller);
    });

    it("should clear abort controller", () => {
      const controller = new AbortController();
      setZKEmailProofPollingAbortController(controller);
      setZKEmailProofPollingAbortController(null);

      expect(getZKEmailProofPollingAbortController()).toBeNull();
    });

    it("should be independent from signing abort controller", () => {
      const signingController = new AbortController();
      const pollingController = new AbortController();

      setZKEmailSigningAbortController(signingController);
      setZKEmailProofPollingAbortController(pollingController);

      expect(getZKEmailSigningAbortController()).toBe(signingController);
      expect(getZKEmailProofPollingAbortController()).toBe(pollingController);
      expect(getZKEmailSigningAbortController()).not.toBe(
        getZKEmailProofPollingAbortController(),
      );
    });
  });

  describe("turnstile token provider", () => {
    it("should set and get turnstile token provider", async () => {
      const provider = vi.fn().mockResolvedValue("token-123");
      setZKEmailTurnstileTokenProvider(provider);

      const currentProvider = getZKEmailTurnstileTokenProvider();
      expect(currentProvider).toBe(provider);
      await expect(currentProvider?.()).resolves.toBe("token-123");
    });

    it("should clear turnstile token provider", () => {
      setZKEmailTurnstileTokenProvider(async () => "token");
      setZKEmailTurnstileTokenProvider(null);

      expect(getZKEmailTurnstileTokenProvider()).toBeNull();
    });
  });
});
