import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useXionDisconnect } from "../../hooks/useXionDisconnect";

const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockStytch = { session: { revoke: vi.fn() } };

vi.mock("@stytch/react", () => ({
  useStytch: () => mockStytch,
}));

vi.mock("../../auth/useAuthState", () => ({
  useAuthState: () => ({ logout: mockLogout }),
}));

describe("useXionDisconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("xionDisconnect calls logout with origin and stytch client", async () => {
    const { result } = renderHook(() => useXionDisconnect());

    await act(async () => {
      await result.current.xionDisconnect();
    });

    expect(mockLogout).toHaveBeenCalledWith(window.location.origin, mockStytch);
  });

  it("switchAccount calls logout with notifyParent: false", async () => {
    const { result } = renderHook(() => useXionDisconnect());

    await act(async () => {
      await result.current.switchAccount();
    });

    expect(mockLogout).toHaveBeenCalledWith(window.location.origin, mockStytch, {
      notifyParent: false,
    });
  });

  it("xionDisconnect and switchAccount use different options", async () => {
    const { result } = renderHook(() => useXionDisconnect());

    await act(async () => {
      await result.current.xionDisconnect();
      await result.current.switchAccount();
    });

    expect(mockLogout).toHaveBeenCalledTimes(2);
    expect(mockLogout).toHaveBeenNthCalledWith(1, window.location.origin, mockStytch);
    expect(mockLogout).toHaveBeenNthCalledWith(2, window.location.origin, mockStytch, {
      notifyParent: false,
    });
  });
});
