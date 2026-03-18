import { screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { mockEnvironmentVariables } from "./utils";
import { UserEvent } from "@testing-library/user-event";

mockEnvironmentVariables({
  VITE_TIKTOK_FLAG: "true",
});

/**
 * Standard mock for Stytch authentication service
 * @returns A mock Stytch object with common methods
 */
export function createStytchMock() {
  return {
    oauth: {
      google: {
        start: vi.fn().mockResolvedValue(undefined),
      },
    },
    otps: {
      email: {
        loginOrCreate: vi.fn().mockResolvedValue({
          method_id: "test-method-id",
          status_code: 200,
        }),
      },
      authenticate: vi.fn().mockResolvedValue({
        status_code: 200,
        session: {
          session_token: "test-session-token",
        },
      }),
    },
    session: {
      getSync: vi.fn().mockReturnValue({
        session_token: "test-session-token",
      }),
      authenticate: vi.fn().mockResolvedValue({
        status_code: 200,
        session: {
          session_token: "test-session-token",
        },
      }),
    },
    webauthn: {
      register: {
        start: vi.fn().mockResolvedValue({
          status_code: 200,
          method_id: "test-webauthn-method-id",
        }),
        authenticate: vi.fn().mockResolvedValue({
          status_code: 200,
          session: {
            session_token: "test-session-token",
          },
        }),
      },
    },
  };
}

/**
 * Helper to fill OTP inputs with a code.
 * Works with both the input-otp library (single hidden input) and
 * individual spinbutton inputs.
 * @param _user The user event instance (kept for API compatibility)
 * @param code The OTP code to fill (default: '123456')
 */
export async function fillOtpInputs(_user: UserEvent, code = "123456") {
  // input-otp renders a single hidden input rather than multiple spinbutton inputs
  const hiddenInput = screen.queryByRole("textbox", { hidden: true });
  if (hiddenInput) {
    fireEvent.change(hiddenInput, { target: { value: code } });
    return;
  }
  // Fallback for individual spinbutton input patterns
  const otpInputs = screen.getAllByRole("spinbutton");
  for (let i = 0; i < Math.min(otpInputs.length, code.length); i++) {
    fireEvent.change(otpInputs[i], { target: { value: code[i] } });
  }
}
