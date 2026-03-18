import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "../../..";
import SpinnerV2 from "../../../../components/ui/icons/SpinnerV2";

describe("SpinnerV2 Component", () => {
  it("renders with default props (md, black)", async () => {
    await render(<SpinnerV2 />);
    const svg = screen.getByTestId("spinner-v2-icon");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });

  it("renders with sm size", async () => {
    await render(<SpinnerV2 size="sm" />);
    const svg = screen.getByTestId("spinner-v2-icon");
    expect(svg).toHaveAttribute("width", "24");
  });

  it("renders with lg size", async () => {
    await render(<SpinnerV2 size="lg" />);
    const svg = screen.getByTestId("spinner-v2-icon");
    expect(svg).toHaveAttribute("width", "64");
  });

  it("renders with white color", async () => {
    const { container } = await render(<SpinnerV2 color="white" />);
    const stops = container.querySelectorAll("stop");
    expect(stops[0]).toHaveAttribute("stop-color", "rgba(255, 255, 255, 0)");
    expect(stops[1]).toHaveAttribute(
      "stop-color",
      "rgba(255, 255, 255, 0.05)",
    );
    expect(stops[2]).toHaveAttribute("stop-color", "white");
  });

  it("renders with black color (default)", async () => {
    const { container } = await render(<SpinnerV2 color="black" />);
    const stops = container.querySelectorAll("stop");
    expect(stops[0]).toHaveAttribute("stop-color", "rgba(0, 0, 0, 0)");
    expect(stops[1]).toHaveAttribute("stop-color", "rgba(0, 0, 0, 0.05)");
    expect(stops[2]).toHaveAttribute("stop-color", "black");
  });

  it("has proper accessibility attributes", async () => {
    await render(<SpinnerV2 />);
    const svg = screen.getByRole("status");
    expect(svg).toHaveAttribute("aria-label", "Loading");
  });
});
