import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../..";

const { mockSlots } = vi.hoisted(() => {
  const mockSlots: Array<{
    char: string | null;
    hasFakeCaret: boolean;
    isActive: boolean;
  }> = [];
  return { mockSlots };
});

vi.mock("input-otp", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const OTPInputContext = React.createContext({ slots: mockSlots });

  const OTPInput = React.forwardRef<HTMLInputElement, Record<string, unknown>>(
    ({ containerClassName, className, children, ...props }, ref) =>
      React.createElement(
        "div",
        { className: containerClassName, "data-testid": "otp-input" },
        React.createElement("input", { ref, className, ...props }),
        children,
      ),
  );
  OTPInput.displayName = "OTPInput";

  return { OTPInput, OTPInputContext };
});

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "../../../components/ui/input-otp";

function setSlots(
  slots: Array<{
    char: string | null;
    hasFakeCaret: boolean;
    isActive: boolean;
  }>,
) {
  mockSlots.length = 0;
  slots.forEach((s) => mockSlots.push(s));
}

describe("InputOTP Components", () => {
  describe("InputOTP", () => {
    it("renders with default classes", async () => {
      await render(
        <InputOTP maxLength={6} value="" onChange={() => {}}>
          <div>children</div>
        </InputOTP>,
      );
      expect(screen.getByTestId("otp-input")).toBeInTheDocument();
    });

    it("applies custom containerClassName", async () => {
      await render(
        <InputOTP
          maxLength={6}
          value=""
          onChange={() => {}}
          containerClassName="custom-container"
        >
          <div>children</div>
        </InputOTP>,
      );
      const container = screen.getByTestId("otp-input");
      expect(container).toHaveClass("custom-container");
    });

    it("applies custom className", async () => {
      await render(
        <InputOTP
          maxLength={6}
          value=""
          onChange={() => {}}
          className="custom-input"
        >
          <div>children</div>
        </InputOTP>,
      );
      const input = screen.getByTestId("otp-input").querySelector("input");
      expect(input).toHaveClass("custom-input");
    });
  });

  describe("InputOTPGroup", () => {
    it("renders with default classes", async () => {
      await render(
        <InputOTPGroup data-testid="group">
          <div>slot</div>
        </InputOTPGroup>,
      );
      const group = screen.getByTestId("group");
      expect(group).toHaveClass("ui-flex", "ui-items-center");
    });

    it("applies custom className", async () => {
      await render(
        <InputOTPGroup data-testid="group" className="custom">
          <div>slot</div>
        </InputOTPGroup>,
      );
      expect(screen.getByTestId("group")).toHaveClass("custom");
    });
  });

  describe("InputOTPSlot", () => {
    it("renders a slot with a character", async () => {
      setSlots([{ char: "5", hasFakeCaret: false, isActive: false }]);
      await render(<InputOTPSlot index={0} data-testid="slot" />);
      expect(screen.getByTestId("slot")).toHaveTextContent("5");
    });

    it("renders active state with ring classes", async () => {
      setSlots([{ char: null, hasFakeCaret: false, isActive: true }]);
      await render(<InputOTPSlot index={0} data-testid="slot" />);
      const slot = screen.getByTestId("slot");
      expect(slot).toHaveClass("ui-ring-1");
    });

    it("renders fake caret when hasFakeCaret is true", async () => {
      setSlots([{ char: null, hasFakeCaret: true, isActive: true }]);
      const { container } = await render(
        <InputOTPSlot index={0} data-testid="slot" />,
      );
      const caret = container.querySelector(".ui-animate-caret-blink");
      expect(caret).toBeInTheDocument();
    });

    it("does not render fake caret when hasFakeCaret is false", async () => {
      setSlots([{ char: null, hasFakeCaret: false, isActive: false }]);
      const { container } = await render(
        <InputOTPSlot index={0} data-testid="slot" />,
      );
      const caret = container.querySelector(".ui-animate-caret-blink");
      expect(caret).not.toBeInTheDocument();
    });

    it("applies custom className", async () => {
      setSlots([{ char: null, hasFakeCaret: false, isActive: false }]);
      await render(
        <InputOTPSlot index={0} data-testid="slot" className="custom" />,
      );
      expect(screen.getByTestId("slot")).toHaveClass("custom");
    });
  });

  describe("InputOTPSeparator", () => {
    it("renders separator with dash", async () => {
      await render(<InputOTPSeparator data-testid="sep" />);
      const sep = screen.getByTestId("sep");
      expect(sep).toHaveAttribute("role", "separator");
      expect(sep).toHaveTextContent("-");
    });
  });
});
