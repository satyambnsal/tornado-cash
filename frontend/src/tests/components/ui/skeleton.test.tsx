import React from "react";
import { describe, it, expect } from "vitest";
import { Skeleton } from "../../../components/ui/skeleton";
import { render, screen, testCommonComponentProps } from "../..";

describe("Skeleton Component", () => {
  // Use the common component props utility to test className and HTML props
  testCommonComponentProps(Skeleton, {}, "skeleton");

  it("renders with default classes", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("ui-animate-pulse", "ui-rounded-md");
  });

  it("renders children when provided", () => {
    render(
      <Skeleton data-testid="skeleton">
        <div>Child content</div>
      </Skeleton>,
    );
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveTextContent("Child content");
  });

  it("renders with multiple custom classes", () => {
    render(
      <Skeleton
        className="custom-width custom-height custom-color"
        data-testid="skeleton"
      />,
    );
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass(
      "custom-width",
      "custom-height",
      "custom-color",
      "ui-animate-pulse",
      "ui-rounded-md",
    );
  });
});
