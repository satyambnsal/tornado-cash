import React from "react";
import { describe, it, expect, vi } from "vitest";
import { Input } from "../../../components/ui/input";
import { testFormInputBehavior, render, screen } from "../..";

describe("Input Component", () => {
  // Test common form input behavior
  testFormInputBehavior(Input, { placeholder: "Test Input" });

  it("renders input with placeholder", async () => {
    await render(<Input placeholder="Enter text" />);
    expect(screen.getByText("Enter text")).toBeInTheDocument();
  });

  it("applies custom className", async () => {
    await render(<Input className="custom-class" placeholder="Test" />);
    const wrapper = screen.getByText("Test").parentElement;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("applies custom baseInputClassName to input element", async () => {
    await render(
      <Input baseInputClassName="custom-input-class" placeholder="Test" />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("custom-input-class");
  });

  it("shows error message when error prop is provided", async () => {
    const errorMessage = "This field is required";
    await render(<Input error={errorMessage} placeholder="Test" />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("applies error styling when error prop is provided", async () => {
    await render(<Input error="Error message" placeholder="Test" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("ui-border-destructive");
  });

  it("handles focus and blur events correctly", async () => {
    const { user } = await render(<Input placeholder="Test" />);
    const input = screen.getByRole("textbox");
    const label = screen.getByText("Test");

    // Initial state
    expect(label).toHaveClass("ui-top-7");

    // Focus state
    await user.click(input);
    expect(label).toHaveClass("ui-top-0 ui-text-xs");

    // Blur state without value
    await user.tab();
    expect(label).toHaveClass("ui-top-7");
  });

  it("maintains focused label position when input has value", async () => {
    await render(<Input placeholder="Test" value="Some text" />);
    const label = screen.getByText("Test");
    expect(label).toHaveClass("ui-top-0 ui-text-xs");
  });

  it("calls onBlur callback when provided", async () => {
    const handleBlur = vi.fn();
    const { user } = await render(
      <Input placeholder="Test" onBlur={handleBlur} />,
    );
    const input = screen.getByRole("textbox");

    await user.click(input);
    await user.tab();
    expect(handleBlur).toHaveBeenCalled();
  });

  it("calls onKeyDown callback when provided", async () => {
    const handleKeyDown = vi.fn();
    const { user } = await render(
      <Input placeholder="Test" onKeyDown={handleKeyDown} />,
    );
    const input = screen.getByRole("textbox");

    await user.click(input);
    await user.keyboard("{Enter}");
    expect(handleKeyDown).toHaveBeenCalled();
  });

  it("passes through additional HTML input props", async () => {
    await render(
      <Input
        placeholder="Test"
        data-testid="test-input"
        maxLength={10}
        disabled
      />,
    );
    const input = screen.getByRole("textbox");

    expect(input).toHaveAttribute("data-testid", "test-input");
    expect(input).toHaveAttribute("maxlength", "10");
    expect(input).toBeDisabled();
  });
});
