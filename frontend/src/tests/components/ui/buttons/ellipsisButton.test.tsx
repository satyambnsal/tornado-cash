import React from "react";
import { describe, it, expect, vi } from "vitest";
import { EllipsisButton } from "../../../../components/ui/buttons/ellipsis-button";
import { testRefForwarding, render } from "../../..";

describe("EllipsisButton", () => {
  // Test ref forwarding
  testRefForwarding(EllipsisButton, {}, HTMLButtonElement);

  it("renders with correct default styles", async () => {
    const { container } = await render(<EllipsisButton />);
    expect(container.firstChild).toHaveClass(
      "ui-w-7 ui-h-7 ui-rounded-full ui-border ui-border-surface-border",
    );
  });

  it("applies custom className correctly", async () => {
    const customClass = "test-class";
    const { container } = await render(
      <EllipsisButton className={customClass} />,
    );
    expect(container.firstChild).toHaveClass(customClass);
  });

  it("renders three dots", async () => {
    const { container } = await render(<EllipsisButton />);
    const dots = container.getElementsByClassName(
      "ui-bg-text-secondary ui-rounded-full",
    );
    expect(dots).toHaveLength(3);
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const { container, user } = await render(
      <EllipsisButton onClick={handleClick} />,
    );
    const button = container.firstChild as HTMLElement;

    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies hover styles correctly", async () => {
    const { container } = await render(<EllipsisButton />);
    const button = container.firstChild as HTMLElement;
    expect(button).toHaveClass("hover:ui-bg-surface-page");
  });
});
