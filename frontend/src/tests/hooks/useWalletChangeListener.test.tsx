import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWalletChangeListener } from "../../hooks/useWalletChangeListener";
import {
  AuthStateManager,
  CONNECTION_METHOD,
} from "../../auth/AuthStateManager";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import type { SelectedSmartAccount } from "../../types/wallet-account-types";

// Mutable mock value for CHAIN_ID
const mockConfigValues: Record<string, unknown> = {
  CHAIN_ID: "xion-testnet-1",
};

vi.mock("../../config", () => ({
  get CHAIN_ID() {
    return mockConfigValues.CHAIN_ID;
  },
}));

// Mock dependencies
vi.mock("../../utils", () => ({
  getHumanReadablePubkey: vi.fn((pubKey: Uint8Array) => {
    // Simulate different authenticators for different keys
    return `authenticator_${pubKey[0]}`;
  }),
}));

describe("useWalletChangeListener", () => {
  const mockChainId = "xion-testnet-1";

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up config mock
    mockConfigValues.CHAIN_ID = mockChainId;

    // Mock Keplr wallet
    window.keplr = {
      getKey: vi.fn().mockResolvedValue({
        pubKey: new Uint8Array([1, 2, 3, 4]),
      }),
    } as unknown as typeof window.keplr;

    // Mock OKX wallet
    window.okxwallet = {
      keplr: {
        getKey: vi.fn().mockResolvedValue({
          pubKey: new Uint8Array([1, 2, 3, 4]),
        }),
      },
    } as unknown as typeof window.okxwallet;

    // Mock MetaMask
    window.ethereum = {
      on: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as typeof window.ethereum;

    // Initialize auth state manager
    AuthStateManager.initialize();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).keplr;
    delete (window as unknown as Record<string, unknown>).okxwallet;
    delete (window as unknown as Record<string, unknown>).ethereum;
    localStorage.clear();
  });

  describe("Keplr wallet change detection", () => {
    it("should logout when Keplr keystore changes to a different account", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Log in with Keplr
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      // Render the hook
      renderHook(() => useWalletChangeListener());

      // Wait for initial setup
      await waitFor(() => {
        expect(window.keplr?.getKey).not.toHaveBeenCalled();
      });

      // Simulate wallet account change - new pubkey
      window.keplr!.getKey = vi.fn().mockResolvedValue({
        pubKey: new Uint8Array([5, 6, 7, 8]), // Different pubkey
      });

      // Trigger keystore change event
      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should logout because authenticator changed
      expect(logoutSpy).toHaveBeenCalled();
    });

    it("should NOT logout when keystore event fires but account hasn't changed", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Log in with Keplr
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      // Trigger keystore change event but wallet returns same pubkey
      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should NOT logout because authenticator is the same
      expect(logoutSpy).not.toHaveBeenCalled();
    });
  });

  describe("OKX wallet change detection", () => {
    it("should logout when OKX keystore changes to a different account", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Log in with OKX
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.OKX,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      // Simulate wallet account change
      window.okxwallet!.keplr.getKey = vi.fn().mockResolvedValue({
        pubKey: new Uint8Array([9, 10, 11, 12]), // Different pubkey
      });

      // Trigger keystore change event
      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  describe("MetaMask account change detection", () => {
    it("should logout when MetaMask account changes", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Log in with MetaMask
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        "0x1234567890abcdef",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      // Get the accountsChanged handler that was registered
      const onCall = vi.mocked(window.ethereum!.on).mock.calls.find(
        (call: unknown[]) => call[0] === "accountsChanged",
      );
      expect(onCall).toBeDefined();
      const accountsChangedHandler = onCall[1];

      // Simulate account change
      await act(async () => {
        await accountsChangedHandler(["0xnewaddress"]);
      });

      expect(logoutSpy).toHaveBeenCalled();
    });

    it("should logout when MetaMask disconnects (empty accounts)", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Log in with MetaMask
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        "0x1234567890abcdef",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      // Get the accountsChanged handler
      const onCall = vi.mocked(window.ethereum!.on).mock.calls.find(
        (call: unknown[]) => call[0] === "accountsChanged",
      );
      const accountsChangedHandler = onCall[1];

      // Simulate disconnect (empty accounts array)
      await act(async () => {
        await accountsChangedHandler([]);
      });

      expect(logoutSpy).toHaveBeenCalled();
    });

    it("should NOT logout when MetaMask account hasn't changed", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Log in with MetaMask
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        "0x1234567890abcdef",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      // Get the accountsChanged handler
      const onCall = vi.mocked(window.ethereum!.on).mock.calls.find(
        (call: unknown[]) => call[0] === "accountsChanged",
      );
      const accountsChangedHandler = onCall[1];

      // Trigger with same account
      await act(async () => {
        await accountsChangedHandler(["0x1234567890abcdef"]);
      });

      // Should NOT logout
      expect(logoutSpy).not.toHaveBeenCalled();
    });
  });

  describe("BUG: Connection method switching", () => {
    it("should properly reset previousAuthenticator when switching from Keplr to MetaMask", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Step 1: Login with Keplr
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1keplr",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      const { rerender, unmount } = renderHook(() => useWalletChangeListener());

      // Wait for Keplr listener to be set up
      await waitFor(() => {
        expect(AuthStateManager.getState().connectionMethod).toBe(
          CONNECTION_METHOD.Keplr,
        );
      });

      // Step 2: Logout (simulating user disconnect)
      await act(async () => {
        await AuthStateManager.logout();
      });

      // Step 3: Login with MetaMask (different wallet type)
      await act(async () => {
        AuthStateManager.startLogin(
          AUTHENTICATOR_TYPE.EthWallet,
          CONNECTION_METHOD.Metamask,
          "0xmetamask123",
        );
        AuthStateManager.completeLogin({
          id: "xion1metamask",
          currentAuthenticatorIndex: 0,
        } as unknown as SelectedSmartAccount);
      });

      // Force rerender to trigger useEffect with new connection method
      rerender();

      // Step 4: Simulate MetaMask account change
      const onCall = vi.mocked(window.ethereum!.on).mock.calls.find(
        (call: unknown[]) => call[0] === "accountsChanged",
      );

      // BUG: If previousAuthenticator wasn't reset, it will still have "authenticator_1" (Keplr)
      // and when we compare with MetaMask address "0xnewmetamask", it will incorrectly detect
      // a change and logout, even though this is the first time using MetaMask in this session

      if (onCall) {
        const accountsChangedHandler = onCall[1];

        logoutSpy.mockClear(); // Clear previous logout calls

        // Trigger accountsChanged with the SAME account we logged in with
        await act(async () => {
          await accountsChangedHandler(["0xmetamask123"]);
        });

        // EXPECTED: Should NOT logout because account hasn't changed
        // ACTUAL (BUG): May logout if previousAuthenticator still has Keplr value
        expect(logoutSpy).not.toHaveBeenCalled();
      }

      unmount();
    });

    it("should properly reset previousAuthenticator when switching from MetaMask to Keplr", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Step 1: Login with MetaMask
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        "0xmetamask123",
      );
      AuthStateManager.completeLogin({
        id: "xion1metamask",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      const { rerender, unmount } = renderHook(() => useWalletChangeListener());

      // Step 2: Logout
      await act(async () => {
        await AuthStateManager.logout();
      });

      // Step 3: Login with Keplr
      await act(async () => {
        AuthStateManager.startLogin(
          AUTHENTICATOR_TYPE.Secp256K1,
          CONNECTION_METHOD.Keplr,
          "authenticator_1",
        );
        AuthStateManager.completeLogin({
          id: "xion1keplr",
          currentAuthenticatorIndex: 0,
        } as unknown as SelectedSmartAccount);
      });

      rerender();

      // Wait for Keplr listener setup
      await new Promise((resolve) => setTimeout(resolve, 100));

      logoutSpy.mockClear();

      // Step 4: Trigger keystore change with SAME authenticator
      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // EXPECTED: Should NOT logout because authenticator hasn't changed
      // ACTUAL (BUG): May logout if previousAuthenticator still has MetaMask value
      expect(logoutSpy).not.toHaveBeenCalled();

      unmount();
    });

    it("should handle rapid connection method changes correctly", async () => {
      const logoutSpy = vi.spyOn(AuthStateManager, "logout");

      // Login with Keplr
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1keplr",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      const { rerender, unmount } = renderHook(() => useWalletChangeListener());

      // Rapidly switch wallets
      await act(async () => {
        await AuthStateManager.logout();
        AuthStateManager.startLogin(
          AUTHENTICATOR_TYPE.EthWallet,
          CONNECTION_METHOD.Metamask,
          "0xmetamask",
        );
        AuthStateManager.completeLogin({
          id: "xion1metamask",
          currentAuthenticatorIndex: 0,
        } as unknown as SelectedSmartAccount);
      });

      rerender();

      await act(async () => {
        await AuthStateManager.logout();
        AuthStateManager.startLogin(
          AUTHENTICATOR_TYPE.Secp256K1,
          CONNECTION_METHOD.OKX,
          "authenticator_1", // Using authenticator_1 to match the mock getKey response
        );
        AuthStateManager.completeLogin({
          id: "xion1okx",
          currentAuthenticatorIndex: 0,
        } as unknown as SelectedSmartAccount);
      });

      rerender();

      logoutSpy.mockClear();

      // Trigger OKX keystore change with SAME authenticator
      // Mock returns pubKey [1,2,3,4] which produces "authenticator_1" via getHumanReadablePubkey
      window.okxwallet!.keplr.getKey = vi.fn().mockResolvedValue({
        pubKey: new Uint8Array([1, 2, 3, 4]),
      });

      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should NOT logout if previousAuthenticator was properly reset
      expect(logoutSpy).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe("Event cleanup", () => {
    it("should remove Keplr event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      const { unmount } = renderHook(() => useWalletChangeListener());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keplr_keystorechange",
        expect.any(Function),
      );
    });

    it("should remove MetaMask event listener on unmount", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        "0x1234567890abcdef",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      const { unmount } = renderHook(() => useWalletChangeListener());

      unmount();

      expect(window.ethereum?.removeListener).toHaveBeenCalledWith(
        "accountsChanged",
        expect.any(Function),
      );
    });
  });

  describe("Not connected scenarios", () => {
    it("should not set up wallet listeners for non-wallet connections (e.g. Stytch)", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      // Login with Stytch (JWT) - not a wallet connection
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "jwt-authenticator",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      const { unmount } = renderHook(() => useWalletChangeListener());

      // Should not add keplr_keystorechange listener
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        "keplr_keystorechange",
        expect.any(Function),
      );

      // Should not add MetaMask listener
      expect(window.ethereum!.on).not.toHaveBeenCalledWith(
        "accountsChanged",
        expect.any(Function),
      );

      unmount();
      addEventListenerSpy.mockRestore();
    });

    it("should not set up listeners when user is not connected", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      // Don't connect
      AuthStateManager.resetState();

      renderHook(() => useWalletChangeListener());

      // Should not add any event listeners
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        "keplr_keystorechange",
        expect.any(Function),
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle missing Keplr wallet gracefully", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      delete (window as unknown as Record<string, unknown>).keplr;

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[useWalletChangeListener] Wallet not found",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle missing OKX wallet gracefully", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      delete (window as unknown as Record<string, unknown>).okxwallet;

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.OKX,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[useWalletChangeListener] Wallet not found",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle missing window.ethereum when connected with MetaMask", () => {
      // Remove window.ethereum
      delete (window as unknown as Record<string, unknown>).ethereum;

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        "0x1234567890abcdef",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      // Should not throw when window.ethereum is undefined
      const { unmount } = renderHook(() => useWalletChangeListener());

      // No event listener should be registered since ethereum is not available
      unmount();
    });

    it("should handle missing chain ID gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockConfigValues.CHAIN_ID = "";

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useWalletChangeListener] No Chain ID is configured",
      );

      consoleErrorSpy.mockRestore();
      mockConfigValues.CHAIN_ID = mockChainId;
    });

    it("should handle errors during keystore change gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const testError = new Error("Test error");

      window.keplr!.getKey = vi.fn().mockRejectedValue(testError);

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "authenticator_1",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
      } as unknown as SelectedSmartAccount);

      renderHook(() => useWalletChangeListener());

      await act(async () => {
        window.dispatchEvent(new Event("keplr_keystorechange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useWalletChangeListener] Error handling keystore change:",
        testError,
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
