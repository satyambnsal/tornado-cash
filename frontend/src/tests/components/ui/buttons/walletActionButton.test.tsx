import React from "react";
import { describe, it, expect } from "vitest";
import { WalletActionButton } from "../../../../components/ui/buttons/walletActionButton";
import { testRefForwarding, render, screen } from "../../..";

describe("WalletActionButton", () => {
  // Test ref forwarding
  testRefForwarding(WalletActionButton, { type: "receive" }, HTMLButtonElement);

  it("renders receive button correctly", async () => {
    await render(<WalletActionButton type="receive" />);
    expect(screen.getByText("Receive")).toBeInTheDocument();
  });

  it("renders send button correctly", async () => {
    await render(<WalletActionButton type="send" />);
    expect(screen.getByText("Send")).toBeInTheDocument();
  });

  it("applies custom className correctly", async () => {
    const customClass = "test-class";
    const { container } = await render(
      <WalletActionButton type="receive" className={customClass} />,
    );
    expect(container.firstChild).toHaveClass(customClass);
  });

  it("applies hover styles correctly", async () => {
    const { container } = await render(<WalletActionButton type="send" />);
    const button = container.firstChild as HTMLElement;
    expect(button).toHaveClass("hover:ui-bg-surface-border");
  });
});
