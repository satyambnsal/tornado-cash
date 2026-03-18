import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useZKEmailVerificationFlow } from "../../hooks/useZKEmailVerificationFlow";
import {
  setZKEmailProofPollingAbortController,
  getZKEmailProofPollingAbortController,
} from "../../auth/zk-email/zk-email-signing-status";
import {
  verifyEmailWithZKEmail,
  pollZKEmailStatusUntilComplete,
  isValidZKEmailFormat,
  toActionableZKEmailError,
} from "../../auth/utils/zk-email";

vi.mock("../../auth/zk-email/zk-email-signing-status", () => {
  let controller: AbortController | null = null;
  return {
    setZKEmailProofPollingAbortController: vi.fn((next: AbortController | null) => {
      controller = next;
    }),
    getZKEmailProofPollingAbortController: vi.fn(() => controller),
  };
});

vi.mock("../../auth/utils/zk-email", () => ({
  isValidZKEmailFormat: vi.fn(() => true),
  verifyEmailWithZKEmail: vi.fn(),
  pollZKEmailStatusUntilComplete: vi.fn(),
  toActionableZKEmailError: vi.fn((msg: string) => msg),
  ZK_EMAIL_POLL_START_DELAY_MS: 2000,
  ZK_EMAIL_PROOF_TIMEOUT_MS: 300000,
  ZK_EMAIL_POLL_INTERVAL_MS: 3000,
  ZK_EMAIL_STATUS: {
    email_sent_awaiting_reply: "email_sent_awaiting_reply",
  },
}));

describe("useZKEmailVerificationFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(isValidZKEmailFormat).mockReturnValue(true);
    vi.mocked(toActionableZKEmailError).mockImplementation((msg) => msg);
    vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
      success: true,
      proofId: "proof-123",
    });
    vi.mocked(pollZKEmailStatusUntilComplete).mockResolvedValue({
      proofId: "proof-123",
      status: "proof_generation_success",
      proof: {
        proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
        publicInputs: ["salt"],
      },
    } as unknown as Awaited<ReturnType<typeof pollZKEmailStatusUntilComplete>>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reset clears pending start delay timer", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { result } = renderHook(() =>
      useZKEmailVerificationFlow({ onError: vi.fn() }),
    );

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    expect(result.current.phase).toBe("waiting");
    expect(result.current.proofId).toBe("proof-123");

    act(() => {
      result.current.reset();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(result.current.phase).toBe("form");
    expect(result.current.proofId).toBeNull();
    expect(result.current.currentStatus).toBeNull();
    expect(result.current.verificationResult).toBeNull();
  });

  it("cleans up polling controller on unmount", () => {
    const { unmount } = renderHook(() => useZKEmailVerificationFlow());
    expect(setZKEmailProofPollingAbortController).toHaveBeenCalled();
    expect(getZKEmailProofPollingAbortController()).toBeInstanceOf(
      AbortController,
    );

    unmount();

    expect(setZKEmailProofPollingAbortController).toHaveBeenLastCalledWith(null);
  });

  it("completes full happy path through polling", async () => {
    const pollResult = {
      proofId: "proof-123",
      status: "proof_generation_success",
      proof: {
        proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
        publicInputs: ["salt"],
      },
    } as unknown as Awaited<ReturnType<typeof pollZKEmailStatusUntilComplete>>;
    vi.mocked(pollZKEmailStatusUntilComplete).mockImplementation(
      async (_proofId, opts) => {
        opts?.onStatus?.({ proofId: "proof-123", status: "generating_proof" } as unknown as Awaited<ReturnType<typeof pollZKEmailStatusUntilComplete>>);
        return pollResult;
      },
    );
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useZKEmailVerificationFlow({ onError }),
    );

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    expect(result.current.phase).toBe("waiting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.phase).toBe("success");
    expect(result.current.verificationResult).toBeTruthy();
    expect(result.current.isProcessing).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("throws when verification succeeds but proofId is missing", async () => {
    vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
      success: true,
    } as unknown as Awaited<ReturnType<typeof verifyEmailWithZKEmail>>);
    vi.mocked(toActionableZKEmailError).mockImplementation((msg) => `mapped:${msg}`);
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    expect(toActionableZKEmailError).toHaveBeenCalledWith("No proof ID returned");
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("mapped:No proof ID returned");
    expect(onError).toHaveBeenCalledWith("mapped:No proof ID returned");
  });

  it("setError uses fallback message for empty input", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    act(() => {
      result.current.setError("   ");
    });

    expect(result.current.error).toBe(
      "Failed to send verification email. Please try again.",
    );
    expect(onError).toHaveBeenCalledWith(
      "Failed to send verification email. Please try again.",
    );
  });

  it("returns early with validation error for invalid email format", async () => {
    vi.mocked(isValidZKEmailFormat).mockReturnValue(false);
    const onError = vi.fn();
    const getTurnstileToken = vi.fn().mockResolvedValue("token-123");
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "invalid-email",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken,
      });
    });

    expect(getTurnstileToken).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Please enter a valid email address");
    expect(onError).toHaveBeenCalledWith("Please enter a valid email address");
  });

  it("uses fallback turnstile error for non-Error rejections", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => {
          throw "turnstile failed";
        },
      });
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe(
      "Failed to verify you're human. Please try again.",
    );
    expect(onError).toHaveBeenCalledWith(
      "Failed to verify you're human. Please try again.",
    );
  });

  it("handles non-Error failure from verification request", async () => {
    vi.mocked(verifyEmailWithZKEmail).mockRejectedValue("backend string failure");
    vi.mocked(toActionableZKEmailError).mockImplementation((msg) => `mapped:${msg}`);
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    expect(toActionableZKEmailError).toHaveBeenCalledWith(
      "Failed to send verification email",
    );
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("mapped:Failed to send verification email");
    expect(onError).toHaveBeenCalledWith(
      "mapped:Failed to send verification email",
    );
  });

  it("handles non-Error polling failure by stringifying the reason", async () => {
    vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue("poll failed");
    vi.mocked(toActionableZKEmailError).mockImplementation((msg) => `mapped:${msg}`);
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(toActionableZKEmailError).toHaveBeenCalledWith("poll failed");
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("mapped:poll failed");
    expect(onError).toHaveBeenCalledWith("mapped:poll failed");
  });

  it("uses Error.message for Error rejections from turnstile", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => {
          throw new Error("widget expired");
        },
      });
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("widget expired");
    expect(onError).toHaveBeenCalledWith("widget expired");
  });

  it("handles unsuccessful verification response", async () => {
    vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
      success: false,
      error: "rate limited",
    } as unknown as Awaited<ReturnType<typeof verifyEmailWithZKEmail>>);
    vi.mocked(toActionableZKEmailError).mockImplementation((msg) => `mapped:${msg}`);
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    expect(toActionableZKEmailError).toHaveBeenCalledWith("rate limited");
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("mapped:rate limited");
    expect(onError).toHaveBeenCalledWith("mapped:rate limited");
  });

  it("uses Error.message for Error rejections from polling", async () => {
    vi.mocked(pollZKEmailStatusUntilComplete).mockRejectedValue(
      new Error("proof timed out"),
    );
    vi.mocked(toActionableZKEmailError).mockImplementation((msg) => `mapped:${msg}`);
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(toActionableZKEmailError).toHaveBeenCalledWith("proof timed out");
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("mapped:proof timed out");
    expect(onError).toHaveBeenCalledWith("mapped:proof timed out");
  });

  it("handles cancelled polling when controller is aborted before delayed poll starts", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    const controller = getZKEmailProofPollingAbortController();
    expect(controller).toBeInstanceOf(AbortController);
    controller?.abort();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("Cancelled");
    expect(onError).toHaveBeenCalledWith("Cancelled");
    expect(pollZKEmailStatusUntilComplete).not.toHaveBeenCalled();
  });

  it("uses default error when data.error is falsy on failure", async () => {
    vi.mocked(verifyEmailWithZKEmail).mockResolvedValue({
      success: false,
    } as unknown as Awaited<ReturnType<typeof verifyEmailWithZKEmail>>);
    vi.mocked(toActionableZKEmailError).mockImplementation((msg) => `mapped:${msg}`);
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    expect(toActionableZKEmailError).toHaveBeenCalledWith(
      "Failed to send verification email",
    );
    expect(result.current.phase).toBe("error");
  });

  it("handles null polling controller gracefully when timeout fires after unmount", async () => {
    vi.mocked(setZKEmailProofPollingAbortController).mockImplementation(() => {});
    vi.mocked(getZKEmailProofPollingAbortController).mockReturnValue(null as unknown as AbortController);
    const onError = vi.fn();
    const { result } = renderHook(() => useZKEmailVerificationFlow({ onError }));

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => "token-123",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.phase).toBe("success");
  });

  it("reset is safe to call when no timer is pending", () => {
    const { result } = renderHook(() => useZKEmailVerificationFlow());

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe("form");
    expect(result.current.error).toBeNull();
  });

  it("passes through token value returned by turnstile provider", async () => {
    const { result } = renderHook(() => useZKEmailVerificationFlow());

    await act(async () => {
      await result.current.startVerification({
        email: "user@example.com",
        command: "xion1command",
        xionAddress: "xion1address",
        getTurnstileToken: async () => undefined as unknown as string,
      });
    });

    expect(verifyEmailWithZKEmail).toHaveBeenCalledWith(
      "user@example.com",
      "xion1command",
      "xion1address",
      undefined,
    );
  });
});
