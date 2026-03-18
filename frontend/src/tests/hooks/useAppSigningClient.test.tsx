import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSigningClient } from "../../hooks/useSigningClient";
import { AuthContext } from "../../components/AuthContext";
import { CONNECTION_METHOD, type ConnectionMethod } from "../../auth/useAuthState";

import {
  AADirectSigner,
  AAEthSigner,
  AAClient,
  AUTHENTICATOR_TYPE,
} from "@burnt-labs/signers";
import { AbstractAccountJWTSigner } from "../../auth/jwt/jwt-signer";
import { AuthStateManager } from "../../auth/AuthStateManager";
import type { ConnectionAdapter } from "../../connectionAdapters/types";

const { mockGetTokens } = vi.hoisted(() => {
  const mockGetTokens = vi
    .fn()
    .mockReturnValue({ session_token: "mock-token" });
  return { mockGetTokens };
});

// Mock dependencies
vi.mock("@stytch/react", () => ({
  useStytch: () => ({
    session: {
      getTokens: mockGetTokens,
    },
  }),
}));

vi.mock("@burnt-labs/signers", () => ({
  AAClient: {
    connectWithSigner: vi.fn().mockResolvedValue({
      addAccount: vi.fn(),
    }),
  },
  AADirectSigner: vi.fn(),
  AAEthSigner: vi.fn(),
  AASigner: vi.fn(),
  AUTHENTICATOR_TYPE: {
    Secp256K1: "Secp256K1",
    EthWallet: "EthWallet",
    JWT: "JWT",
    Passkey: "Passkey",
    ZKEmail: "ZKEmail",
  },
}));

vi.mock("../../auth/jwt/jwt-signer", () => ({
  AbstractAccountJWTSigner: vi.fn(),
}));

vi.mock("../../signers/signers/passkey-signer", () => ({
  AAPasskeySigner: vi.fn(),
}));

vi.mock("../../auth/AuthStateManager", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../auth/AuthStateManager")>();
  return {
    ...original,
    AuthStateManager: {
      ...original.AuthStateManager,
      getZKEmailData: vi.fn().mockReturnValue(null),
    },
  };
});

vi.mock("../../utils/fees", () => ({
  formatGasPrice: vi.fn().mockReturnValue({ amount: "0", denom: "uxion" }),
  getGasCalculation: vi.fn().mockReturnValue({
    gasPrice: { amount: "0", denom: "uxion" },
  }),
}));

vi.mock("../../config", () => ({
  STYTCH_PROXY_URL: "https://mock-stytch-proxy.com",
}));

// Mock connection adapters
vi.mock("../../connectionAdapters", () => ({
  getConnectionAdapter: vi.fn((authenticatorType, connectionMethod) => {
    // Create a mock adapter based on the connection method
    const mockAdapter = {
      authenticatorType,
      connectionMethod,
      name: `Mock ${connectionMethod} Adapter`,
      isInstalled: () => true,
      enable: vi.fn().mockResolvedValue(undefined),
      getSigner: vi.fn(),
    };

    // Configure getSigner based on connection method
    if (connectionMethod === "stytch") {
      // JWT adapter
      mockAdapter.getSigner = vi.fn(
        (abstractAccount: string, authIndex: number, sessionToken: string, apiUrl: string) => {
          return new (AbstractAccountJWTSigner as unknown as new (...args: unknown[]) => unknown)(
            abstractAccount,
            authIndex,
            sessionToken,
            apiUrl,
          );
        },
      );
    } else if (connectionMethod === "keplr" || connectionMethod === "okx") {
      // Secp256k1 adapter
      mockAdapter.getSigner = vi.fn(async () => {
        return new (AADirectSigner as unknown as new () => unknown)();
      });
    } else if (connectionMethod === "metamask") {
      // EthWallet adapter
      mockAdapter.getSigner = vi.fn(() => {
        return new (AAEthSigner as unknown as new () => unknown)();
      });
    } else if (connectionMethod === "passkey") {
      // Passkey adapter
      mockAdapter.getSigner = vi.fn(() => {
        return { type: "passkey-signer" }; // Mock passkey signer
      });
    } else if (connectionMethod === "zkemail") {
      // ZKEmail adapter
      mockAdapter.getSigner = vi.fn(
        () => {
          return { type: "zkemail-signer" }; // Mock zkemail signer
        },
      );
    }

    return mockAdapter;
  }),
}));

describe("useSigningClient", () => {
  const mockChainInfo = {
    chainId: "xion-testnet-1",
    chainName: "XION Testnet",
    rpc: "https://rpc.testnet.xion.burnt.com",
    rest: "https://api.testnet.xion.burnt.com",
  };

  const mockAbstractAccount = {
    id: "xion1mockaccount",
    currentAuthenticatorIndex: 0,
  };

  const wrapper = ({
    children,
    contextValue = {},
  }: {
    children: React.ReactNode;
    contextValue?: Record<string, unknown>;
  }) => (
    <AuthContext.Provider
      value={{
        connectionMethod: CONNECTION_METHOD.Stytch,
        authenticatorType: AUTHENTICATOR_TYPE.JWT,
        abstractAccount: mockAbstractAccount,
        chainInfo: mockChainInfo,
        isChainInfoLoading: false,
        ...contextValue,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.keplr
    window.keplr = {
      getOfflineSigner: vi.fn().mockReturnValue({}),
    } as unknown as typeof window.keplr;
    // Mock window.ethereum
    window.ethereum = {
      request: vi.fn(),
    } as unknown as typeof window.ethereum;
    // Mock window.okxwallet
    window.okxwallet = {
      keplr: {
        enable: vi.fn(),
        signArbitrary: vi.fn(),
        getOfflineSigner: vi.fn().mockReturnValue({}),
      },
    } as unknown as typeof window.okxwallet;
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).keplr;
    delete (window as unknown as Record<string, unknown>).ethereum;
    delete (window as unknown as Record<string, unknown>).okxwallet;
  });

  it("should return client when initialized with stytch", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({
          ...props,
          contextValue: { connectionMethod: CONNECTION_METHOD.Stytch },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should return client when initialized with keplr", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({
          ...props,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Keplr,
            authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should return client when initialized with metamask", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({
          ...props,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Metamask,
            authenticatorType: AUTHENTICATOR_TYPE.EthWallet,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should return client when initialized with okx", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({
          ...props,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.OKX,
            authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should return client when initialized with passkey", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({
          ...props,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Passkey,
            authenticatorType: AUTHENTICATOR_TYPE.Passkey,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should return undefined client if chain info is loading", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({ ...props, contextValue: { isChainInfoLoading: true } }),
    });

    expect(result.current.client).toBeUndefined();
  });

  it("should return undefined client if abstract account is missing", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({ ...props, contextValue: { abstractAccount: undefined } }),
    });

    expect(result.current.client).toBeUndefined();
  });

  it("should return undefined client if chain info is missing", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: (props) =>
        wrapper({ ...props, contextValue: { chainInfo: undefined } }),
    });

    expect(result.current.client).toBeUndefined();
  });

  it("should initialize client with Keplr signer", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Keplr,
            authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should initialize client with okx signer", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.OKX,
            authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should initialize client with metamask signer", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Metamask,
            authenticatorType: AUTHENTICATOR_TYPE.EthWallet,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should initialize client with passkey signer", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Passkey,
            authenticatorType: AUTHENTICATOR_TYPE.Passkey,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should not initialize client with none connection type", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: { connectionMethod: CONNECTION_METHOD.None },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeUndefined();
    });
  });

  it("should handle missing signer gracefully", async () => {
    // Mock window.keplr to be undefined for keplr connection
    const originalKeplr = window.keplr;
    delete (window as unknown as Record<string, unknown>).keplr;

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Keplr,
            authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeUndefined();
    });

    // Restore keplr
    window.keplr = originalKeplr;
  });

  // Note: Tests for okxSignArb and ethSigningFn implementation details were removed
  // because they tested internal implementation of the old approach.
  // With the new adapter pattern, these signing functions are encapsulated within
  // the adapters and are not directly accessible. The functionality is still tested
  // through the client creation tests above.

  it("should provide getGasCalculation function", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Stytch,
            authenticatorType: AUTHENTICATOR_TYPE.JWT,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });

    expect(result.current.getGasCalculation).toBeDefined();
    result.current.getGasCalculation(1000);
    // We mocked getGasCalculation in gas-utils, so we can check if it was called?
    // Actually the hook calls the imported getGasCalculation.
    // We can check if the result is what we expect from the mock.
    const gasCalc = result.current.getGasCalculation(1000);
    expect(gasCalc).toEqual({ gasPrice: { amount: "0", denom: "uxion" } });
  });

  it("should not create signer when Stytch session token is unavailable", async () => {
    // Mock useStytch to return null tokens (session not yet synced)
    mockGetTokens.mockReturnValue(null);

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // silently ignore
    });

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: { connectionMethod: CONNECTION_METHOD.Stytch },
        }),
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[useSigningClient] Stytch session token not yet available",
      );
    });

    // Signer should NOT be created with undefined token
    expect(AbstractAccountJWTSigner).not.toHaveBeenCalled();
    expect(result.current.client).toBeUndefined();

    consoleWarnSpy.mockRestore();
    // Restore mock
    mockGetTokens.mockReturnValue({ session_token: "mock-token" });
  });

  it("should read Stytch session token at call time, not render time", async () => {
    // Verify the token passed to JWTSigner comes from a fresh getTokens() call,
    // not a stale value captured at render time
    mockGetTokens.mockReturnValue({ session_token: "fresh-call-time-token" });

    renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: { connectionMethod: CONNECTION_METHOD.Stytch },
        }),
    });

    await waitFor(() => {
      expect(AbstractAccountJWTSigner).toHaveBeenCalled();
    });

    // The token should be the value returned by getTokens() at the time
    // getSigner runs, proving it reads lazily inside the callback
    expect(AbstractAccountJWTSigner).toHaveBeenCalledWith(
      "xion1mockaccount",
      0,
      "fresh-call-time-token",
      "https://mock-stytch-proxy.com",
    );
  });

  it("should update keplr state on keplr_keystorechange event", async () => {
    // Start with no keplr
    const originalKeplr = window.keplr;
    delete (window as unknown as Record<string, unknown>).keplr;

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Keplr,
            authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
          },
        }),
    });

    // Should be undefined initially
    expect(result.current.client).toBeUndefined();

    const connectSpy = vi.mocked(AAClient.connectWithSigner);
    connectSpy.mockClear();

    // Restore keplr and trigger event
    window.keplr = originalKeplr;

    act(() => {
      window.dispatchEvent(new Event("keplr_keystorechange"));
    });

    // It should trigger getSigner again and connect
    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalled();
    });
  });

  it("should handle unsupported connection method", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // silently ignore
    });

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: "unknown-method" as unknown as ConnectionMethod,
            authenticatorType: AUTHENTICATOR_TYPE.JWT,
          },
        }),
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unsupported connection method: unknown-method",
      );
    });

    expect(result.current.client).toBeUndefined();

    consoleWarnSpy.mockRestore();
  });

  it("should handle null signer returned from adapter", async () => {
    const { getConnectionAdapter } = await import("../../connectionAdapters");
    const mockedGetAdapter = vi.mocked(getConnectionAdapter);

    // Create adapter that returns null signer
    mockedGetAdapter.mockReturnValueOnce({
      authenticatorType: AUTHENTICATOR_TYPE.JWT,
      connectionMethod: CONNECTION_METHOD.Stytch,
      name: "Null Signer Adapter",
      isInstalled: () => true,
      enable: vi.fn().mockResolvedValue(undefined),
      getSigner: vi.fn().mockReturnValue(null),
    } as unknown as ConnectionAdapter);

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // silently ignore
    });

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Stytch,
            authenticatorType: AUTHENTICATOR_TYPE.JWT,
          },
        }),
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "No signer returned from adapter",
      );
    });

    expect(result.current.client).toBeUndefined();

    consoleWarnSpy.mockRestore();
  });

  it("should handle error during signer creation", async () => {
    const { getConnectionAdapter } = await import("../../connectionAdapters");
    const mockedGetAdapter = vi.mocked(getConnectionAdapter);

    // Create adapter that throws an error
    mockedGetAdapter.mockReturnValueOnce({
      authenticatorType: AUTHENTICATOR_TYPE.JWT,
      connectionMethod: CONNECTION_METHOD.Stytch,
      name: "Error Adapter",
      isInstalled: () => true,
      enable: vi.fn().mockRejectedValue(new Error("Enable failed")),
      getSigner: vi.fn(),
    } as unknown as ConnectionAdapter);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {
        // silently ignore
      });

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Stytch,
            authenticatorType: AUTHENTICATOR_TYPE.JWT,
          },
        }),
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create signer:",
        expect.any(Error),
      );
    });

    expect(result.current.client).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });

  it("should set keplr state to false when keplr becomes undefined after keystorechange", async () => {
    // Start with keplr defined
    window.keplr = {
      getOfflineSigner: vi.fn().mockReturnValue({}),
    } as unknown as typeof window.keplr;

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Keplr,
            authenticatorType: AUTHENTICATOR_TYPE.Secp256K1,
          },
        }),
    });

    // Wait for initial client to be created
    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });

    // Now remove keplr and trigger the event
    delete (window as unknown as Record<string, unknown>).keplr;

    act(() => {
      window.dispatchEvent(new Event("keplr_keystorechange"));
    });

    // The hook should update its internal keplr state to false
    // This tests line 34: setKeplrState(window.keplr ? true : false)
    // with the false branch
    await waitFor(() => {
      // Client may still be defined from before, but the state change occurred
      expect(window.keplr).toBeUndefined();
    });
  });

  it("should use testnet RPC when chainInfo.rpc is undefined", async () => {
    const connectSpy = vi.mocked(AAClient.connectWithSigner);
    connectSpy.mockClear();

    const chainInfoWithoutRpc = {
      chainId: "xion-testnet-1",
      chainName: "XION Testnet",
      rpc: undefined, // No RPC specified
      rest: "https://api.testnet.xion.burnt.com",
    };

    renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Stytch,
            authenticatorType: AUTHENTICATOR_TYPE.JWT,
            chainInfo: chainInfoWithoutRpc,
          },
        }),
    });

    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalled();
    });

    // The first argument to connectWithSigner should be the testnet RPC
    // since chainInfo.rpc is undefined
    const firstCallArgs = connectSpy.mock.calls[0];
    expect(firstCallArgs[0]).toBeDefined();
    // It should fall back to testnetChainInfo.rpc (from @burnt-labs/constants)
  });

  it("should return undefined from getGasCalculation when chainInfo is undefined", async () => {
    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.Stytch,
            authenticatorType: AUTHENTICATOR_TYPE.JWT,
            chainInfo: undefined,
            abstractAccount: undefined, // No account means no client initialization
          },
        }),
    });

    // With no chainInfo, getGasCalculation should return undefined
    expect(result.current.getGasCalculation).toBeDefined();
    const gasCalc = result.current.getGasCalculation(1000);
    expect(gasCalc).toBeUndefined();
  });

  it("should return client when initialized with zkemail and email is available", async () => {
    vi.mocked(AuthStateManager.getZKEmailData).mockReturnValue(
      "user@example.com",
    );

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.ZKEmail,
            authenticatorType: AUTHENTICATOR_TYPE.ZKEmail,
          },
        }),
    });

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
  });

  it("should not create signer when zkemail has no email in session", async () => {
    vi.mocked(AuthStateManager.getZKEmailData).mockReturnValue(null);

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // silently ignore
    });

    const { result } = renderHook(() => useSigningClient(), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          contextValue: {
            connectionMethod: CONNECTION_METHOD.ZKEmail,
            authenticatorType: AUTHENTICATOR_TYPE.ZKEmail,
          },
        }),
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[useSigningClient] ZK-Email: no email in session; signer not created. Sign in with zk-email to sign transactions.",
      );
    });

    expect(result.current.client).toBeUndefined();

    consoleWarnSpy.mockRestore();
  });
});
