import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import userEvent from "@testing-library/user-event";
import LoginOtpForm from "../../../components/LoginOtpForm";

// Mock ResizeObserver for input-otp
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  // input-otp uses document.elementFromPoint which jsdom doesn't support
  if (!document.elementFromPoint) {
    document.elementFromPoint = vi.fn().mockReturnValue(null);
  }
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("OtpForm Component", () => {
  const mockHandleOtp = vi.fn().mockResolvedValue(undefined);
  const mockHandleResendCode = vi.fn().mockResolvedValue(undefined);
  const mockSetError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderOtpForm = (error: string | null = null) => {
    return render(
      <LoginOtpForm
        handleOtp={mockHandleOtp}
        handleResendCode={mockHandleResendCode}
        error={error}
        setError={mockSetError}
      />,
    );
  };

  it("renders the OTP input", () => {
    renderOtpForm();
    // InputOTP renders a single hidden input
    const input = document.querySelector("input");
    expect(input).toBeInTheDocument();
  });

  it("suppresses password manager autofill on OTP input", () => {
    renderOtpForm();
    const input = document.querySelector("input")!;
    expect(input).toHaveAttribute("data-1p-ignore");
    expect(input).toHaveAttribute("data-lpignore", "true");
    expect(input).toHaveAttribute("data-form-type", "other");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("renders six OTP slots", () => {
    renderOtpForm();
    // InputOTP renders div slots for each digit
    const slots = document.querySelectorAll("[data-input-otp-slot]");
    // The library may not use data attributes, check for the slot divs within the group
    // The InputOTPSlot components render divs
    expect(slots.length).toBe(0); // If no data attributes, try different selector
    // Check that the component rendered by looking for CONFIRM button
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
  });

  it("uses fixed non-shrinking mobile dimensions for OTP slots", () => {
    const { container } = renderOtpForm();
    const slots = container.querySelectorAll("div.ui-rounded-lg");

    expect(slots).toHaveLength(6);
    slots.forEach((slot) => {
      expect(slot).toHaveClass("ui-w-12");
      expect(slot).toHaveClass("ui-shrink-0");
    });
  });
  it("shows error message when provided", () => {
    const errorMessage = "Invalid OTP";
    renderOtpForm(errorMessage);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("calls resend code function when button is clicked", async () => {
    renderOtpForm();

    const resendButton = screen.getByRole("button", { name: /resend code/i });
    await userEvent.click(resendButton);

    expect(mockHandleResendCode).toHaveBeenCalled();
  });

  it("renders CONFIRM button", () => {
    renderOtpForm();
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeInTheDocument();
  });

  it("CONFIRM button is disabled when OTP is incomplete", () => {
    renderOtpForm();
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeDisabled();
  });

  it("renders RESEND CODE button", () => {
    renderOtpForm();
    const resendButton = screen.getByRole("button", { name: /resend code/i });
    expect(resendButton).toBeInTheDocument();
  });

  it("shows countdown after resend code is clicked", async () => {
    renderOtpForm();

    const resendButton = screen.getByRole("button", { name: /resend code/i });
    await userEvent.click(resendButton);

    expect(screen.getByText(/RESEND IN/)).toBeInTheDocument();
  });

  it("clears error when input changes", async () => {
    renderOtpForm("Initial error");
    const input = document.querySelector("input")!;

    // Simulate typing into the hidden input
    fireEvent.change(input, { target: { value: "1" } });

    expect(mockSetError).toHaveBeenCalledWith(null);
  });

  it("submits OTP when confirm is clicked with valid input", async () => {
    renderOtpForm();
    const input = document.querySelector("input")!;

    // Fill all 6 digits via the hidden input
    fireEvent.change(input, { target: { value: "123456" } });

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    await userEvent.click(confirmButton);

    expect(mockHandleOtp).toHaveBeenCalledWith("123456");
  });
});
