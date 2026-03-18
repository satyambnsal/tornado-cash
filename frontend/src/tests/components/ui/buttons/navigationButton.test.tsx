import React from "react";
import { describe, it, expect } from "vitest";
import { NavigationButton } from "../../../../components/ui/buttons/navigationButton";
import { testRefForwarding, render, screen } from "../../..";

describe("NavigationButton", () => {
  // Test ref forwarding
  testRefForwarding(
    NavigationButton,
    { children: "Button" },
    HTMLButtonElement,
  );

  it("renders with default props", async () => {
    await render(<NavigationButton>Click me</NavigationButton>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Click me");
  });

  it("renders with chevron icon when rightArrow is true", async () => {
    await render(<NavigationButton rightArrow>Next</NavigationButton>);
    const icon = screen.getByTestId("chevron-right-icon");
    expect(icon).toBeInTheDocument();
  });

  it("applies custom className to the button", async () => {
    const customClass = "custom-class";
    await render(
      <NavigationButton className={customClass}>Custom</NavigationButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass(customClass);
  });

  it("renders as disabled when specified", async () => {
    await render(<NavigationButton disabled>Disabled</NavigationButton>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("renders with subLabel", async () => {
    const subLabel = "Sub Label";
    await render(
      <NavigationButton subLabel={subLabel}>Main Label</NavigationButton>,
    );
    expect(screen.getByText("Main Label")).toBeInTheDocument();
    expect(screen.getByText(subLabel)).toBeInTheDocument();
  });

  it("renders with custom icon", async () => {
    const TestIcon = () => <div data-testid="test-icon">Icon</div>;
    await render(
      <NavigationButton icon={<TestIcon />}>With Icon</NavigationButton>,
    );
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });
});
