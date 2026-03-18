import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../..";
import Banner from "../../../components/ui/Banner";
import { AuthContext } from "../../../components/AuthContext";
import type { ChainInfo } from "@burnt-labs/constants";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock window.open
const windowOpenMock = vi.fn();

describe("Banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
    Object.defineProperty(window, "open", {
      value: windowOpenMock,
      writable: true,
    });
    localStorageMock.getItem.mockReturnValue(null);
  });

  const renderWithContext = async (chainId: string) => {
    const contextValue = {
      chainInfo: { chainId } as unknown as ChainInfo,
      abstraxionAccount: undefined,
      abstraxionError: undefined,
      isLoggedIn: false,
      logout: vi.fn(),
      setAbstraxionAccount: vi.fn(),
    };

    return render(
      <AuthContext.Provider value={contextValue}>
        <Banner />
      </AuthContext.Provider>,
    );
  };

  it("should render banner on xion-testnet-1", async () => {
    await renderWithContext("xion-testnet-1");

    expect(
      screen.getByText(/We are migrating to testnet-2 soon!/),
    ).toBeInTheDocument();
  });

  it("should not render banner on mainnet", async () => {
    await renderWithContext("xion-mainnet-1");

    expect(
      screen.queryByText(/We are migrating to testnet-2 soon!/),
    ).not.toBeInTheDocument();
  });

  it("should not render banner if already dismissed", async () => {
    localStorageMock.getItem.mockReturnValue("true");

    await renderWithContext("xion-testnet-1");

    expect(
      screen.queryByText(/We are migrating to testnet-2 soon!/),
    ).not.toBeInTheDocument();
  });

  it("should dismiss banner when close button is clicked", async () => {
    const { user } = await renderWithContext("xion-testnet-1");

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await user.click(dismissButton);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "banner_dismissed",
      "true",
    );
    expect(
      screen.queryByText(/We are migrating to testnet-2 soon!/),
    ).not.toBeInTheDocument();
  });

  it("should open GitHub link when Learn more is clicked", async () => {
    const { user } = await renderWithContext("xion-testnet-1");

    const learnMoreButton = screen.getByRole("button", { name: /learn more/i });
    await user.click(learnMoreButton);

    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://github.com/orgs/burnt-labs/discussions/1",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("should apply custom className", async () => {
    const contextValue = {
      chainInfo: { chainId: "xion-testnet-1" } as unknown as ChainInfo,
      abstraxionAccount: undefined,
      abstraxionError: undefined,
      isLoggedIn: false,
      logout: vi.fn(),
      setAbstraxionAccount: vi.fn(),
    };

    await render(
      <AuthContext.Provider value={contextValue}>
        <Banner className="custom-class" />
      </AuthContext.Provider>,
    );

    const banner = screen
      .getByText(/We are migrating to testnet-2 soon!/)
      .closest("div[class*='ui-w-full']");
    expect(banner).toHaveClass("custom-class");
  });

  it("should not render when chainInfo is undefined", async () => {
    const contextValue = {
      chainInfo: undefined as unknown as ChainInfo,
      abstraxionAccount: undefined,
      abstraxionError: undefined,
      isLoggedIn: false,
      logout: vi.fn(),
      setAbstraxionAccount: vi.fn(),
    };

    await render(
      <AuthContext.Provider value={contextValue}>
        <Banner />
      </AuthContext.Provider>,
    );

    expect(
      screen.queryByText(/We are migrating to testnet-2 soon!/),
    ).not.toBeInTheDocument();
  });
});
