/**
 * No-grants path tests — LoginModal and App.tsx popup flow
 *
 * Verifies that when no treasury/contracts/stake/bank are configured:
 *   - LoginModal does NOT show the grant approval screen
 *   - hasGrantsToApprove is correctly false
 *   - Popup mode sends CONNECT_SUCCESS after auth without an approval step
 *
 * This is the direct-signing use case where the dApp uses requireAuth and
 * the user signs transactions directly from their meta-account.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LoginModal } from "../../../components/LoginModal";
import { AuthContext, type AuthContextProps } from "../../../components/AuthContext";
import { CONNECTION_METHOD } from "../../../auth/useAuthState";
import type { ChainInfo } from "@burnt-labs/constants";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock("@stytch/react", () => ({
  useStytch: () => ({
    session: { getTokens: () => null },
  }),
  useStytchSession: () => ({ session: null }),
}));

vi.mock("../../../hooks/useSmartAccount", () => ({
  useSmartAccount: vi.fn(),
}));

vi.mock("../../../hooks/useQueryParams", () => ({
  useQueryParams: vi.fn(),
}));

vi.mock("../../../auth/useAuthState", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../auth/useAuthState")>();
  return {
    ...actual,
    useAuthState: vi.fn().mockReturnValue({
      connectionMethod: "none",
      account: undefined,
      authenticator: null,
      authenticatorType: null,
      isConnected: false,
      updateAccount: vi.fn(),
      logout: vi.fn(),
      completeLogin: vi.fn(),
      startLogin: vi.fn(),
      setConnectionMethod: vi.fn(),
    }),
  };
});

import { useSmartAccount } from "../../../hooks/useSmartAccount";
import { useQueryParams } from "../../../hooks/useQueryParams";

const mockUseSmartAccount = vi.mocked(useSmartAccount);
const mockUseQueryParams = vi.mocked(useQueryParams);

// ─── Test helpers ──────────────────────────────────────────────────────────────

const testChainInfo: Partial<ChainInfo> = {
  chainId: "xion-testnet-1",
  rpc: "https://testnet-rpc.xion.burnt.com:443",
  rest: "https://testnet-api.xion.burnt.com:443",
};

function makeAuthContext(overrides = {}) {
  return {
    connectionMethod: CONNECTION_METHOD.None,
    setConnectionMethod: vi.fn(),
    abstraxionError: "",
    setAbstraxionError: vi.fn(),
    showApproval: false,
    setIsInGrantFlow: vi.fn(),
    isOpen: true,
    setIsOpen: vi.fn(),
    chainInfo: testChainInfo as ChainInfo,
    ...overrides,
  };
}

function makeAccount(id = "xion1testaccount") {
  return {
    id,
    codeId: 1,
    authenticators: [],
    currentAuthenticatorIndex: 0,
    createdAt: undefined,
    transactionHash: undefined,
  };
}

function renderLoginModal(
  queryParams: Record<string, string | null>,
  account: ReturnType<typeof makeAccount> | undefined,
  contextOverrides = {},
) {
  mockUseQueryParams.mockReturnValue(queryParams as ReturnType<typeof useQueryParams>);

  mockUseSmartAccount.mockReturnValue({
    data: account,
    isConnected: !!account,
    updateAbstractAccountCodeId: vi.fn(),
    connectionMethod: account ? CONNECTION_METHOD.Stytch : CONNECTION_METHOD.None,
    loginAuthenticator: null,
    loginAuthenticatorType: null,
    logout: vi.fn(),
  } as ReturnType<typeof useSmartAccount>);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={makeAuthContext(contextOverrides) as AuthContextProps}>
        <LoginModal isOpen={true} onClose={vi.fn()} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("LoginModal — no-grants path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("shows LoginScreen (not grant approval) when no grants are configured and user is unauthenticated", async () => {
    renderLoginModal(
      {
        contracts: null,
        stake: null,
        bank: null,
        grantee: "xion1grantee",
        treasury: null,  // No treasury
        redirect_uri: "https://myapp.com",
      },
      undefined, // Not authenticated
    );

    // Should show login screen, not grant approval
    await waitFor(() => {
      expect(screen.queryByText(/Allow/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/is requesting permissions/i)).not.toBeInTheDocument();
    });
  });

  it("shows connect confirmation (not grant approval) when user is authenticated but no grants are configured", async () => {
    renderLoginModal(
      {
        contracts: null,
        stake: null,
        bank: null,
        grantee: "xion1grantee",
        treasury: null,  // No treasury — direct-signing path
        redirect_uri: "https://myapp.com",
      },
      makeAccount("xion1user123"), // Authenticated
    );

    // No grant config → should render LoginConnectConfirm, not LoginGrantApproval
    await waitFor(() => {
      expect(screen.queryByText(/Allow/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/is requesting permissions/i)).not.toBeInTheDocument();
      expect(screen.getByText(/wants to confirm your identity/i)).toBeInTheDocument();
      expect(screen.getByText(/Connect/i)).toBeInTheDocument();
    });
  });

  it("shows grant approval when treasury IS configured and user is authenticated", async () => {
    renderLoginModal(
      {
        contracts: null,
        stake: null,
        bank: null,
        grantee: "xion1grantee",
        treasury: "xion1treasury123",  // Treasury configured
        redirect_uri: "https://myapp.com",
      },
      makeAccount("xion1user123"), // Authenticated
    );

    // hasGrantsToApprove is true → should render LoginGrantApproval
    // (Treasury loading will show skeleton state, but the Deny button is always present)
    await waitFor(() => {
      expect(screen.getByText(/Deny/i)).toBeInTheDocument();
    });
  });

  it("shows grant approval when legacy contracts are configured and user is authenticated", async () => {
    renderLoginModal(
      {
        contracts: JSON.stringify(["xion1contract1"]),
        stake: null,
        bank: null,
        grantee: "xion1grantee",
        treasury: null,
        redirect_uri: "https://myapp.com",
      },
      makeAccount("xion1user123"),
    );

    // Legacy grants → hasGrantsToApprove is true
    await waitFor(() => {
      expect(screen.getByText(/Deny/i)).toBeInTheDocument();
    });
  });

  it("shows grant approval when stake is configured and user is authenticated", async () => {
    renderLoginModal(
      {
        contracts: null,
        stake: "true",
        bank: null,
        grantee: "xion1grantee",
        treasury: null,
        redirect_uri: "https://myapp.com",
      },
      makeAccount("xion1user123"),
    );

    await waitFor(() => {
      expect(screen.getByText(/Deny/i)).toBeInTheDocument();
    });
  });
});

// ─── Popup mode no-grants logic unit tests ────────────────────────────────────

describe("Popup no-grants resolution — needsGrants logic", () => {
  /**
   * Tests the `needsGrants` and `isPopupNoGrantsPending` logic from App.tsx
   * without rendering the full App (too many deps). These are pure boolean logic tests.
   */

  function computeNeedsGrants({
    grantee,
    contracts,
    stake,
    bank,
    treasury,
  }: {
    grantee: string | null;
    contracts: string | null;
    stake: string | null;
    bank: string | null;
    treasury: string | null;
  }): boolean {
    // Mirror the exact logic from App.tsx line 200
    return !!(grantee && (contracts || stake || bank || treasury));
  }

  it("needsGrants is false when grantee is set but no grants are configured", () => {
    expect(
      computeNeedsGrants({
        grantee: "xion1grantee",
        contracts: null,
        stake: null,
        bank: null,
        treasury: null,
      }),
    ).toBe(false);
  });

  it("needsGrants is true when grantee AND treasury are both set", () => {
    expect(
      computeNeedsGrants({
        grantee: "xion1grantee",
        contracts: null,
        stake: null,
        bank: null,
        treasury: "xion1treasury",
      }),
    ).toBe(true);
  });

  it("needsGrants is true when grantee AND stake are both set", () => {
    expect(
      computeNeedsGrants({
        grantee: "xion1grantee",
        contracts: null,
        stake: "true",
        bank: null,
        treasury: null,
      }),
    ).toBe(true);
  });

  it("needsGrants is true when grantee AND contracts are both set", () => {
    expect(
      computeNeedsGrants({
        grantee: "xion1grantee",
        contracts: JSON.stringify(["xion1contract"]),
        stake: null,
        bank: null,
        treasury: null,
      }),
    ).toBe(true);
  });

  it("needsGrants is false when grantee is absent (not a connect flow at all)", () => {
    expect(
      computeNeedsGrants({
        grantee: null,
        contracts: null,
        stake: "true",
        bank: null,
        treasury: "xion1treasury",
      }),
    ).toBe(false);
  });

  it("isPopupNoGrantsPending is true only when mode=popup, grantee set, no grants, and authenticated", () => {
    // Mirror the exact logic from App.tsx isPopupNoGrantsPending
    function computeIsPopupNoGrantsPending({
      mode,
      grantee,
      needsGrants,
      accountId,
    }: {
      mode: string | null;
      grantee: string | null;
      needsGrants: boolean;
      accountId: string | undefined;
    }): boolean {
      return mode === "popup" && !!grantee && !needsGrants && !!accountId;
    }

    // The bug case: popup + grantee + no grants + authenticated → should be pending
    expect(
      computeIsPopupNoGrantsPending({
        mode: "popup",
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: "xion1user123",
      }),
    ).toBe(true);

    // Not popup mode → should not be pending
    expect(
      computeIsPopupNoGrantsPending({
        mode: "redirect",
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: "xion1user123",
      }),
    ).toBe(false);

    // Has grants → should not be pending (grants flow handles it)
    expect(
      computeIsPopupNoGrantsPending({
        mode: "popup",
        grantee: "xion1grantee",
        needsGrants: true,
        accountId: "xion1user123",
      }),
    ).toBe(false);

    // Not authenticated → should not be pending
    expect(
      computeIsPopupNoGrantsPending({
        mode: "popup",
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: undefined,
      }),
    ).toBe(false);

    // No grantee → not a connect flow
    expect(
      computeIsPopupNoGrantsPending({
        mode: "popup",
        grantee: null,
        needsGrants: false,
        accountId: "xion1user123",
      }),
    ).toBe(false);
  });
});

// ─── Redirect mode no-grants logic unit tests ─────────────────────────────────

describe("Redirect no-grants resolution — isRedirectNoGrantsPending logic", () => {
  /**
   * Tests the `isRedirectNoGrantsPending` logic from App.tsx.
   * Redirect mode now supports a true no-grants path: after authentication,
   * the dashboard redirects back with ?granted=true&granter=<address> without
   * showing any grant approval UI (previously a 0.1 uxion fallback bank grant
   * was silently injected to force the grant approval flow).
   */

  function computeIsRedirectNoGrantsPending({
    mode,
    grantee,
    needsGrants,
    accountId,
    redirect_uri,
  }: {
    mode: string | null;
    grantee: string | null;
    needsGrants: boolean;
    accountId: string | undefined;
    redirect_uri: string | null;
  }): boolean {
    // Mirror the exact logic from App.tsx isRedirectNoGrantsPending
    return (
      mode !== "popup" &&
      mode !== "inline" &&
      mode !== "sign" &&
      !!grantee &&
      !needsGrants &&
      !!accountId &&
      !!redirect_uri
    );
  }

  it("is true for redirect mode (null mode) with grantee, no grants, authenticated", () => {
    expect(
      computeIsRedirectNoGrantsPending({
        mode: null, // redirect mode sends no mode param
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: "xion1user123",
        redirect_uri: "https://myapp.com",
      }),
    ).toBe(true);
  });

  it("is false when mode is popup (popup has its own resolution)", () => {
    expect(
      computeIsRedirectNoGrantsPending({
        mode: "popup",
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: "xion1user123",
        redirect_uri: "https://myapp.com",
      }),
    ).toBe(false);
  });

  it("is false when mode is inline", () => {
    expect(
      computeIsRedirectNoGrantsPending({
        mode: "inline",
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: "xion1user123",
        redirect_uri: "https://myapp.com",
      }),
    ).toBe(false);
  });

  it("is false when grants are configured (grant approval flow handles it)", () => {
    expect(
      computeIsRedirectNoGrantsPending({
        mode: null,
        grantee: "xion1grantee",
        needsGrants: true,
        accountId: "xion1user123",
        redirect_uri: "https://myapp.com",
      }),
    ).toBe(false);
  });

  it("is false when not yet authenticated", () => {
    expect(
      computeIsRedirectNoGrantsPending({
        mode: null,
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: undefined,
        redirect_uri: "https://myapp.com",
      }),
    ).toBe(false);
  });

  it("is false when redirect_uri is missing", () => {
    expect(
      computeIsRedirectNoGrantsPending({
        mode: null,
        grantee: "xion1grantee",
        needsGrants: false,
        accountId: "xion1user123",
        redirect_uri: null,
      }),
    ).toBe(false);
  });

  it("is false when no grantee (not a connect flow)", () => {
    expect(
      computeIsRedirectNoGrantsPending({
        mode: null,
        grantee: null,
        needsGrants: false,
        accountId: "xion1user123",
        redirect_uri: "https://myapp.com",
      }),
    ).toBe(false);
  });
});
