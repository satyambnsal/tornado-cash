import { describe, expect, it } from "vitest";
import { render, screen } from "../..";
import { Separator } from "../../../components/ui/separator";

describe("Separator", () => {
  it("renders horizontal separator by default", async () => {
    await render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId("sep");
    expect(sep).toHaveClass("ui-h-[1px]");
    expect(sep).toHaveClass("ui-w-full");
  });

  it("renders vertical separator when orientation is vertical", async () => {
    await render(<Separator orientation="vertical" data-testid="sep" />);
    const sep = screen.getByTestId("sep");
    expect(sep).toHaveClass("ui-w-[1px]");
    expect(sep).toHaveClass("ui-h-full");
  });

  it("applies custom className", async () => {
    await render(<Separator className="custom-class" data-testid="sep" />);
    expect(screen.getByTestId("sep")).toHaveClass("custom-class");
  });

  it("is decorative by default", async () => {
    await render(<Separator data-testid="sep" />);
    expect(screen.getByTestId("sep")).toHaveAttribute("data-orientation", "horizontal");
  });
});
