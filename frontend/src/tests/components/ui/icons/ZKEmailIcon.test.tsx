import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "../../..";
import { ZKEmailIcon } from "../../../../components/ui/icons/ZKEmailIcon";

describe("ZKEmailIcon", () => {
  it("renders svg with provided className", async () => {
    const { container } = await render(<ZKEmailIcon className="zk-email-test" />);
    const svg = container.querySelector("svg.zk-email-test");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
