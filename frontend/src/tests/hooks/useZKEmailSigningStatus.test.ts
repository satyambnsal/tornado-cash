import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useZKEmailSigningStatus } from "../../hooks/useZKEmailSigningStatus";
import {
  setZKEmailSigningStatus,
  ZKEmailSigningStatus,
} from "../../auth/zk-email/zk-email-signing-status";

describe("useZKEmailSigningStatus", () => {
  beforeEach(() => {
    // Reset status before each test
    setZKEmailSigningStatus(null);
  });

  afterEach(() => {
    setZKEmailSigningStatus(null);
  });

  it("should return null initially when no status is set", () => {
    const { result } = renderHook(() => useZKEmailSigningStatus());

    expect(result.current).toBeNull();
  });

  it("should return current status when status is already set", () => {
    const initialStatus: ZKEmailSigningStatus = {
      phase: "in_progress",
      message: "Sending email...",
    };
    setZKEmailSigningStatus(initialStatus);

    const { result } = renderHook(() => useZKEmailSigningStatus());

    expect(result.current).toEqual(initialStatus);
  });

  it("should update when status changes", () => {
    const { result } = renderHook(() => useZKEmailSigningStatus());

    expect(result.current).toBeNull();

    act(() => {
      setZKEmailSigningStatus({
        phase: "in_progress",
        message: "Processing...",
      });
    });

    expect(result.current).toEqual({
      phase: "in_progress",
      message: "Processing...",
    });
  });

  it("should handle status transitions", () => {
    const { result } = renderHook(() => useZKEmailSigningStatus());

    // Start with in_progress
    act(() => {
      setZKEmailSigningStatus({
        phase: "in_progress",
        message: "Sending verification email...",
      });
    });
    expect(result.current?.phase).toBe("in_progress");

    // Update to success
    act(() => {
      setZKEmailSigningStatus({
        phase: "success",
        message: "Proof generated successfully!",
      });
    });
    expect(result.current?.phase).toBe("success");

    // Clear status
    act(() => {
      setZKEmailSigningStatus(null);
    });
    expect(result.current).toBeNull();
  });

  it("should handle error status", () => {
    const { result } = renderHook(() => useZKEmailSigningStatus());

    act(() => {
      setZKEmailSigningStatus({
        phase: "error",
        message: "Failed to send email",
      });
    });

    expect(result.current?.phase).toBe("error");
    expect(result.current?.message).toBe("Failed to send email");
  });

  it("should include detail when provided", () => {
    const { result } = renderHook(() => useZKEmailSigningStatus());

    act(() => {
      setZKEmailSigningStatus({
        phase: "in_progress",
        message: "Generating proof",
        detail: "This may take 10-30 seconds",
      });
    });

    expect(result.current?.detail).toBe("This may take 10-30 seconds");
  });

  it("should unsubscribe on unmount", () => {
    const { result, unmount } = renderHook(() => useZKEmailSigningStatus());

    act(() => {
      setZKEmailSigningStatus({
        phase: "in_progress",
        message: "Working...",
      });
    });

    expect(result.current?.phase).toBe("in_progress");

    unmount();

    // After unmount, changing status shouldn't throw or cause issues
    // (the hook should have unsubscribed)
    act(() => {
      setZKEmailSigningStatus({
        phase: "success",
        message: "Done",
      });
    });

    // Result is stale after unmount, but no errors should occur
  });

  it("should handle rapid status updates", () => {
    const { result } = renderHook(() => useZKEmailSigningStatus());

    act(() => {
      setZKEmailSigningStatus({ phase: "in_progress", message: "Step 1" });
      setZKEmailSigningStatus({ phase: "in_progress", message: "Step 2" });
      setZKEmailSigningStatus({ phase: "in_progress", message: "Step 3" });
      setZKEmailSigningStatus({ phase: "success", message: "Done" });
    });

    // Should have the final value
    expect(result.current).toEqual({
      phase: "success",
      message: "Done",
    });
  });

  it("should return null and avoid subscription when disabled", () => {
    const { result } = renderHook(() => useZKEmailSigningStatus(false));

    act(() => {
      setZKEmailSigningStatus({
        phase: "in_progress",
        message: "Ignored",
      });
    });

    expect(result.current).toBeNull();
  });

  it("should return null and avoid subscribing when disabled", () => {
    setZKEmailSigningStatus({
      phase: "in_progress",
      message: "Should not be observed",
    });

    const { result } = renderHook(() => useZKEmailSigningStatus(false));
    expect(result.current).toBeNull();

    act(() => {
      setZKEmailSigningStatus({
        phase: "success",
        message: "Still ignored",
      });
    });

    expect(result.current).toBeNull();
  });

  it("should unsubscribe and return null when toggled from enabled to disabled", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useZKEmailSigningStatus(enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      setZKEmailSigningStatus({
        phase: "in_progress",
        message: "Active status",
      });
    });

    expect(result.current).toEqual({
      phase: "in_progress",
      message: "Active status",
    });

    rerender({ enabled: false });

    expect(result.current).toBeNull();
  });

  it("should subscribe when enabled toggles from false to true", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useZKEmailSigningStatus(enabled),
      { initialProps: { enabled: false } },
    );

    expect(result.current).toBeNull();

    act(() => {
      setZKEmailSigningStatus({
        phase: "in_progress",
        message: "visible on enable",
      });
    });

    rerender({ enabled: true });

    expect(result.current).toEqual({
      phase: "in_progress",
      message: "visible on enable",
    });
  });
});
