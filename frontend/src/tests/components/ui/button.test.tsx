import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "../..";
import { Button } from "../../../components/ui/button";

describe("Button Component", () => {
  it("renders as a button element by default", async () => {
    await render(<Button data-testid="btn">Click me</Button>);
    const btn = screen.getByTestId("btn");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveTextContent("Click me");
  });

  it("renders with default variant and size classes", async () => {
    await render(<Button data-testid="btn">Default</Button>);
    const btn = screen.getByTestId("btn");
    expect(btn).toHaveClass("ui-bg-cta");
    expect(btn).toHaveClass("ui-h-12");
  });

  it("renders as child element when asChild is true", async () => {
    await render(
      <Button asChild data-testid="link-btn">
        <a href="/test">Link button</a>
      </Button>,
    );
    const link = screen.getByText("Link button");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/test");
  });

  it("applies variant classes", async () => {
    await render(
      <Button variant="secondary" data-testid="btn">
        Secondary
      </Button>,
    );
    const btn = screen.getByTestId("btn");
    expect(btn).toHaveClass("ui-border");
  });

  it("applies size classes", async () => {
    await render(
      <Button size="small" data-testid="btn">
        Small
      </Button>,
    );
    const btn = screen.getByTestId("btn");
    expect(btn).toHaveClass("ui-h-10");
  });

  it("applies custom className", async () => {
    await render(
      <Button className="custom-class" data-testid="btn">
        Custom
      </Button>,
    );
    const btn = screen.getByTestId("btn");
    expect(btn).toHaveClass("custom-class");
  });

  it("forwards ref", async () => {
    const ref = React.createRef<HTMLButtonElement>();
    await render(<Button ref={ref}>Ref button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("passes through disabled prop", async () => {
    await render(
      <Button disabled data-testid="btn">
        Disabled
      </Button>,
    );
    const btn = screen.getByTestId("btn");
    expect(btn).toBeDisabled();
  });
});
