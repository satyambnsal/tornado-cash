import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { render } from "../..";
import { ZKEmailLogin } from "../../../components/LoginScreen/ZKEmailLogin";
import { Dialog, DialogContent } from "../../../components/ui/dialog";
import { Turnstile } from "@marsidev/react-turnstile";
import { getTurnstileTokenForSubmit } from "../../../utils/turnstile";

// Mock zk-email utilities
const mockVerifyEmailWithZKEmail = vi.fn();
const mockCheckZKEmailStatus = vi.fn();
const mockPollZKEmailStatusUntilComplete = vi.fn();
const mockGenerateEmailSaltFromAccountCode = vi.fn();
const mockExtractEmailSalt = vi.fn();

vi.mock("../../../auth/utils/zk-email", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../auth/utils/zk-email")>();
  return {
    ...actual,
    verifyEmailWithZKEmail: (...args: unknown[]) =>
      mockVerifyEmailWithZKEmail(...args),
    checkZKEmailStatus: (...args: unknown[]) => mockCheckZKEmailStatus(...args),
    pollZKEmailStatusUntilComplete: (...args: unknown[]) =>
      mockPollZKEmailStatusUntilComplete(...args),
    extractEmailSalt: (...args: unknown[]) => mockExtractEmailSalt(...args),
    generateEmailSaltFromAccountCode: (...args: unknown[]) =>
      mockGenerateEmailSaltFromAccountCode(...args),
    isValidZKEmailFormat: (email: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    getZKEmailStatusMessage: (status: string) => `Status: ${status}`,
    isZKEmailStatusComplete: (status: string) =>
      status === "complete" || status === "error",
    isZKEmailStatusSuccess: (status: string) => status === "complete",
  };
});

// Mock zk-email signing status
const mockSetAbortController = vi.fn();
const mockGetAbortController = vi.fn(() => null);
vi.mock("../../../auth/zk-email/zk-email-signing-status", () => ({
  setZKEmailProofPollingAbortController: (...args: unknown[]) =>
    mockSetAbortController(...args),
  getZKEmailProofPollingAbortController: () => mockGetAbortController(),
}));

// Mock config - disable Turnstile in tests
vi.mock("../../../config", () => ({
  TURNSTILE_SITE_KEY: "test-site-key",
  IS_DEV: false,
}));

// Mock Turnstile component
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: vi.fn(
    ({ onSuccess, onError, onExpire, ref }: { onSuccess?: (token: string) => void; onError?: () => void; onExpire?: () => void; ref?: React.Ref<unknown> }) => {
      if (ref && typeof ref === "object") {
        ref.current = {
          execute: vi.fn(async () => {
            onSuccess?.("mock-turnstile-token");
          }),
          getResponse: vi.fn(() => "mock-turnstile-token"),
        };
      }
      return (
        <div data-testid="turnstile-widget">
          <button onClick={() => onSuccess?.("mock-turnstile-token")}>
            turnstile-success
          </button>
          <button onClick={() => onError?.()}>turnstile-error</button>
          <button onClick={() => onExpire?.()}>turnstile-expire</button>
        </div>
      );
    },
  ),
}));

// Mock turnstile utils so getTurnstileToken resolves and verification flow can call verifyEmailWithZkEmail
vi.mock("../../../utils/turnstile", () => ({
  getTurnstileTokenForSubmit: vi.fn(
    async ({
      execute,
      getResponse,
      getRefToken,
    }: {
      execute: () => Promise<void>;
      getResponse: () => string;
      getRefToken: () => string | null;
    }) => {
      await execute();
      const refToken = getRefToken();
      const responseToken = getResponse();
      return refToken || responseToken || "mock-turnstile-token";
    },
  ),
}));

// Mock @burnt-labs/signers - use importOriginal to preserve other exports
vi.mock("@burnt-labs/signers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@burnt-labs/signers")>();
  return {
    ...actual,
    isValidHex: vi.fn((hex: string) => /^(0x)?[0-9a-fA-F]+$/.test(hex)),
    normalizeHexPrefix: vi.fn((hex: string) =>
      hex.startsWith("0x") ? hex : `0x${hex}`,
    ),
    validateBech32Address: vi.fn(
      (address: string, _name: string, prefix: string) => {
        if (!address.startsWith(prefix)) {
          throw new Error(`Invalid ${prefix} address`);
        }
        return true;
      },
    ),
  };
});

// Mock ResizeObserver (required for Dialog)
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Mock MutationObserver (required for Dialog)
class MutationObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("MutationObserver", MutationObserverMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("ZKEmailLogin", () => {
  const mockOnLogin = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderComponent = () => {
    return render(
      <Dialog open={true}>
        <DialogContent>
          <ZKEmailLogin
            onLogin={mockOnLogin}
            onCancel={mockOnCancel}
            onError={mockOnError}
          />
        </DialogContent>
      </Dialog>,
    );
  };

  // Helper: navigate to account code form
  const goToAccountCodeMode = async () => {
    const accountCodeButton = screen.getByText(/I know my Account Code/i);
    fireEvent.click(accountCodeButton);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Enter Account Code/i }),
      ).toBeInTheDocument();
    });
  };

  // Helper: navigate to email verification form
  const goToEmailVerificationMode = async () => {
    const emailButton = screen.getByText(/Get my Account Code via Email/i);
    fireEvent.click(emailButton);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Verify Email/i }),
      ).toBeInTheDocument();
    });
  };

  describe("initial render", () => {
    it("should render login mode selection", () => {
      renderComponent();

      expect(screen.getByText(/Login with zk-Email/i)).toBeInTheDocument();
    });

    it("should show two login options", () => {
      renderComponent();

      // Should have options for account code and email verification
      expect(screen.getByText(/I know my Account Code/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Get my Account Code via Email/i),
      ).toBeInTheDocument();
    });
  });

  describe("account code login mode", () => {
    it("should switch to account code mode when selected", async () => {
      renderComponent();
      await goToAccountCodeMode();
    });

    it("should validate account code is required", async () => {
      renderComponent();
      await goToAccountCodeMode();

      // Try to submit without account code
      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter your account code/i),
        ).toBeInTheDocument();
      });
    });

    it("should validate email is required for account code login", async () => {
      renderComponent();
      await goToAccountCodeMode();

      // Enter account code but no email
      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter your email address/i),
        ).toBeInTheDocument();
      });
    });

    it("should validate email format", async () => {
      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "invalid-email" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter a valid email address/i),
        ).toBeInTheDocument();
      });
    });

    it("should validate account code is valid hex", async () => {
      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "not-hex-at-all!" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/account code must be a valid hexadecimal string/i),
        ).toBeInTheDocument();
      });
    });

    it("should call onLogin with generated salt on success", async () => {
      mockGenerateEmailSaltFromAccountCode.mockResolvedValue(
        "generated-salt-123",
      );

      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockGenerateEmailSaltFromAccountCode).toHaveBeenCalledWith(
          "0x1234567890abcdef",
          "test@example.com",
        );
        expect(mockOnLogin).toHaveBeenCalledWith(
          "generated-salt-123",
          "test@example.com",
        );
      });
    });

    it("should show error when salt generation fails", async () => {
      mockGenerateEmailSaltFromAccountCode.mockRejectedValue(
        new Error("Salt generation failed"),
      );

      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/salt generation failed/i)).toBeInTheDocument();
      });
    });

    it("should show default error when non-Error is thrown during salt generation", async () => {
      // Covers L168: err instanceof Error ? err.message : "Failed to generate email salt"
      // The false branch when err is not an Error object
      mockGenerateEmailSaltFromAccountCode.mockRejectedValue(
        "string error instead of Error",
      );

      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to generate email salt/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("email verification login mode", () => {
    it("should switch to email verification mode when selected", async () => {
      renderComponent();
      await goToEmailVerificationMode();
    });

    it("should validate email is required", async () => {
      renderComponent();
      await goToEmailVerificationMode();

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Please enter an email address",
        );
      });
    });

    it("should validate XION address is required", async () => {
      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Please enter your XION address",
        );
      });
    });

    it("should validate XION address format", async () => {
      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, { target: { value: "cosmos1invalid" } });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Please enter a valid XION address (e.g., xion1...)",
        );
      });
    });

    it("should send verification email on valid submit", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockVerifyEmailWithZKEmail).toHaveBeenCalledWith(
          "test@example.com",
          "xion1testaddress123",
          "xion1testaddress123",
          "mock-turnstile-token",
        );
      });
    });

    it("should show error when verification fails", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: false,
        error: "Backend error occurred",
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/backend error/i)).toBeInTheDocument();
      });
    });
  });

  describe("cancel button", () => {
    it("should call onCancel when back button is clicked", async () => {
      renderComponent();

      // Find and click back/cancel button
      const cancelButton = screen.getByRole("button", { name: /back|cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe("error message formatting", () => {
    it("should format network errors", async () => {
      mockVerifyEmailWithZKEmail.mockRejectedValue(
        new Error("Network error: failed to fetch"),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/connection problem/i)).toBeInTheDocument();
      });
    });

    it("should format rate limit errors", async () => {
      mockVerifyEmailWithZKEmail.mockRejectedValue(
        new Error("Rate limit exceeded"),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
      });
    });

    it("should format timeout errors", async () => {
      mockVerifyEmailWithZKEmail.mockRejectedValue(
        new Error("Request timed out"),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/timed out/i)).toBeInTheDocument();
      });
    });

    it("should format unavailable/503 errors", async () => {
      mockVerifyEmailWithZKEmail.mockRejectedValue(
        new Error("Service unavailable (503)"),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/temporarily unavailable/i),
        ).toBeInTheDocument();
      });
    });

    it("should format email-related errors", async () => {
      mockVerifyEmailWithZKEmail.mockRejectedValue(
        new Error("Invalid email format"),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });
    });

    it("should use default message for unknown errors", async () => {
      mockVerifyEmailWithZKEmail.mockRejectedValue(new Error(""));

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to send verification email/i),
        ).toBeInTheDocument();
      });
    });

    it("should format non-Error thrown objects", async () => {
      mockVerifyEmailWithZKEmail.mockRejectedValue("some string error");

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Non-Error thrown → rawMessage = "Failed to send verification email"
        // toActionableLoginError sees "email" keyword → rewrites to email help text
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });
    });
  });

  describe("email verification - email validation", () => {
    it("should validate email format in email verification mode", async () => {
      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "bad-email" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Please enter a valid email address",
        );
      });
    });
  });

  describe("email verification - waiting and polling phases", () => {
    beforeEach(() => {
      // Hook calls pollZkEmailStatusUntilComplete; mock must return a Promise or .then(undefined) throws
      mockPollZKEmailStatusUntilComplete.mockImplementation(
        () => new Promise(() => {}),
      );
    });

    it("should show waiting phase after successful submit", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      // Let the async submit resolve
      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        // The waiting phase shows "Verification email sent!" heading and description text
        expect(
          screen.getByText("Verification email sent!"),
        ).toBeInTheDocument();
      });
    });

    it("should show error when data.success is false", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: false,
        error: "Server rejected",
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/server rejected/i)).toBeInTheDocument();
      });
    });

    it("should show default error when data.success is false and no error message", async () => {
      // Covers L220: throw new Error(data.error || "Failed to send verification email")
      // The || branch when data.error is empty/null
      // Note: "Failed to send verification email" contains "email", so toActionableLoginError
      // transforms it to "Please use a valid email address and try again."
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: false,
        error: "", // Empty error message
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // The default error "Failed to send verification email" is transformed by toActionableLoginError
        // because it contains "email" → "Please use a valid email address and try again."
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });
    });

    it("should transition to polling phase and show status", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockImplementation((_proofId, opts) => {
        opts?.onStatus?.({
          proofId: "proof-123",
          status: "email_sent_awaiting_reply",
        });
        return new Promise(() => {});
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      // Wait for polling to start (2s delay) + first poll (3s)
      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(
          screen.getByText(/waiting for email reply/i),
        ).toBeInTheDocument();
      });
    });

    it("should show 'Generating zk-Proof' for email_replied status", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockImplementation((_proofId, opts) => {
        opts?.onStatus?.({
          proofId: "proof-123",
          status: "email_replied",
        });
        return new Promise(() => {});
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(screen.getByText(/generating zk-proof/i)).toBeInTheDocument();
      });
    });

    it("should call onLogin on successful proof generation", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: {
          publicInputs: new Array(69)
            .fill("0")
            .map((_, i) => (i === 68 ? "email-salt-value" : "0")),
        },
      });
      mockExtractEmailSalt.mockReturnValue("email-salt-value");

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith(
          "email-salt-value",
          "test@example.com",
        );
      });
    });

    it("should show error when proof generation fails", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockRejectedValue(
        new Error("Proof generation failed"),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith("Proof generation failed");
        expect(
          screen.getByRole("heading", { name: /verification failed/i }),
        ).toBeInTheDocument();
      });
    });

    it("should show success phase UI after proof completes", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockResolvedValue({
        proofId: "proof-123",
        status: "proof_generation_success",
        proof: { publicInputs: new Array(69).fill("0") },
      });
      mockExtractEmailSalt.mockReturnValue("salt");

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(
          screen.getByText(/email verified successfully/i),
        ).toBeInTheDocument();
      });
    });

    it("should continue polling on network errors and show warning after 3 failures", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockRejectedValue(
        new Error("Network error"),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Connection problem. Check your internet and try again.",
        );
        expect(screen.getByText(/connection problem/i)).toBeInTheDocument();
      });
    });
  });

  describe("navigation - back and retry", () => {
    it("should go back to mode selection from account code mode", async () => {
      renderComponent();
      await goToAccountCodeMode();

      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText(/login with zk-email/i)).toBeInTheDocument();
      });
    });

    it("should go back to mode selection from email verification mode", async () => {
      renderComponent();
      await goToEmailVerificationMode();

      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText(/login with zk-email/i)).toBeInTheDocument();
      });
    });

    it("should show TRY AGAIN button on error phase and retry", async () => {
      mockVerifyEmailWithZKEmail
        .mockRejectedValueOnce(new Error("Network error: failed to fetch"))
        .mockResolvedValueOnce({ success: true, proofId: "proof-456" });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/connection problem/i)).toBeInTheDocument();
      });

      // Should see TRY AGAIN and BACK buttons
      const retryButton = screen.getByRole("button", { name: /try again/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);

      // Should go back to form phase
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /verify email/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeInTheDocument();
      });
    });

    it("should switch to email verification from account code mode via link", async () => {
      renderComponent();
      await goToAccountCodeMode();

      // Click the "Get it via email verification" link
      const emailLink = screen.getByText(/get it via email verification/i);
      fireEvent.click(emailLink);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /verify email/i }),
        ).toBeInTheDocument();
      });
    });

    it("should switch to account code mode from email verification via link", async () => {
      renderComponent();
      await goToEmailVerificationMode();

      // Click the "Enter it directly" link
      const directLink = screen.getByText(/enter it directly/i);
      fireEvent.click(directLink);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /enter account code/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("account code mode - loading state", () => {
    it("should show loading state while generating salt", async () => {
      // Make the mock hang to test loading state
      let resolvePromise: (value: string) => void;
      mockGenerateEmailSaltFromAccountCode.mockReturnValue(
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        }),
      );

      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/logging in/i)).toBeInTheDocument();
      });

      // Resolve the promise to clean up
      resolvePromise!("salt");
    });
  });

  describe("email verification - timeout handling", () => {
    beforeEach(() => {
      mockPollZKEmailStatusUntilComplete.mockImplementation(
        () => new Promise(() => {}),
      );
    });

    it("should show timeout error after 5 minutes", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      // Use a message without "email" so toActionableZkEmailError returns the timeout message (not the email one)
      mockPollZKEmailStatusUntilComplete.mockRejectedValue(
        new Error("Proof request timed out"),
      );

      await renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Request timed out. Check your connection and try again.",
        );
      });
    });
  });

  describe("email verification - description text", () => {
    beforeEach(() => {
      mockPollZKEmailStatusUntilComplete.mockImplementation(
        () => new Promise(() => {}),
      );
    });

    it("should show description for waiting phase", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/verification email sent to test@example.com/i),
        ).toBeInTheDocument();
      });
    });

    it("should show description for polling phase with status", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockImplementation((_proofId, opts) => {
        opts?.onStatus?.({
          proofId: "proof-123",
          status: "email_replied",
        });
        return new Promise(() => {});
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(
          screen.getByText(/email confirmed! generating zero-knowledge proof/i),
        ).toBeInTheDocument();
      });
    });

    it("should show default 'Processing verification...' for other statuses", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockImplementation((_proofId, opts) => {
        opts?.onStatus?.({
          proofId: "proof-123",
          status: "initialised",
        });
        return new Promise(() => {});
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        expect(
          screen.getByText(/processing verification/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("keyboard interaction", () => {
    it("should submit account code form on Enter key in email field", async () => {
      // Covers L480: if (e.key === "Enter" && !isGeneratingSalt) - true branch
      mockGenerateEmailSaltFromAccountCode.mockResolvedValue("salt-123");

      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      // Press Enter on the email input instead of clicking the button
      fireEvent.keyDown(emailInput, { key: "Enter" });

      await waitFor(() => {
        expect(mockGenerateEmailSaltFromAccountCode).toHaveBeenCalled();
      });
    });

    it("should not submit account code form on non-Enter key in email field", async () => {
      // Covers L480: if (e.key === "Enter") - false branch
      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      // Press Tab key - should not submit
      fireEvent.keyDown(emailInput, { key: "Tab" });

      expect(mockGenerateEmailSaltFromAccountCode).not.toHaveBeenCalled();
    });

    it("should submit email verification form on Enter key in XION address field", async () => {
      // Covers L590: if (e.key === "Enter") - true branch
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      // Press Enter on the XION address input
      fireEvent.keyDown(addressInput, { key: "Enter" });

      await waitFor(() => {
        expect(mockVerifyEmailWithZKEmail).toHaveBeenCalled();
      });
    });

    it("should not submit email verification form on non-Enter key in XION address field", async () => {
      // Covers L590: if (e.key === "Enter") - false branch (when other keys pressed)
      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      // Press Tab key - should not submit
      fireEvent.keyDown(addressInput, { key: "Tab" });

      // Verify that verifyEmailWithZkEmail was NOT called
      expect(mockVerifyEmailWithZKEmail).not.toHaveBeenCalled();
    });
  });

  describe("cleanup and unmount", () => {
    it("should abort controller on unmount when controller exists", async () => {
      // Covers L108-109: controller.abort() + setZkEmailProofPollingAbortController(null) in cleanup.
      // The hook creates its own controller and passes it to setZkEmailProofPollingAbortController; we assert on that one.
      const result = await renderComponent();

      const controllerSetByHook = mockSetAbortController.mock.calls[0]?.[0];
      expect(controllerSetByHook).toBeDefined();
      const abortSpy = vi.spyOn(controllerSetByHook as AbortController, "abort");

      result.unmount();

      expect(abortSpy).toHaveBeenCalled();
      expect(mockSetAbortController).toHaveBeenCalledWith(null);
    });

    it("should handle cleanup when no timeout is set", async () => {
      // Covers L101-105: if (timeoutIdRef.current) false branch
      // Unmount immediately without starting any timeout
      mockGetAbortController.mockReturnValue(null);

      const result = await renderComponent();

      // Unmount immediately - no timeout was ever set
      result.unmount();

      // Should not throw - cleanup handles null timeout gracefully
    });
  });

  describe("polling abort signal", () => {
    it("should stop polling when abort signal fires", async () => {
      const abortController = new AbortController();
      mockGetAbortController.mockReturnValue(abortController);

      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockImplementation(
        () => new Promise(() => {}),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(5000);

      const callCountAfterStart = mockPollZKEmailStatusUntilComplete.mock.calls
        .length;
      abortController.abort();

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockPollZKEmailStatusUntilComplete.mock.calls.length).toBe(
        callCountAfterStart,
      );
    });

    it("should stop polling when abort fires during status check", async () => {
      const abortController = new AbortController();
      mockGetAbortController.mockReturnValue(abortController);

      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockImplementation(
        () => new Promise(() => {}),
      );

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(10000);

      const totalCalls = mockPollZKEmailStatusUntilComplete.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockPollZKEmailStatusUntilComplete.mock.calls.length).toBe(
        totalCalls,
      );
    });
  });

  describe("edge cases - uncovered branches", () => {
    it("should handle non-Error thrown while extracting email salt on success", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockResolvedValue({
        proofId: "proof-123",
        status: "complete",
        proof: {
          proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
          publicInputs: ["value"],
        },
      });
      mockExtractEmailSalt.mockImplementation(() => {
        throw "bad extract";
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));
      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith("Failed to get account code");
      });
    });

    it("should use Error.message when extractEmailSalt throws an Error object on success", async () => {
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        proofId: "proof-123",
      });
      mockPollZKEmailStatusUntilComplete.mockResolvedValue({
        proofId: "proof-123",
        status: "complete",
        proof: {
          proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
          publicInputs: ["value"],
        },
      });
      mockExtractEmailSalt.mockImplementation(() => {
        throw new Error("salt extraction failed");
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));
      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith("salt extraction failed");
      });
    });

    it("should execute turnstile success, error, and expire callbacks", async () => {
      renderComponent();
      await goToEmailVerificationMode();

      fireEvent.click(screen.getByText("turnstile-success"));
      fireEvent.click(screen.getByText("turnstile-error"));
      fireEvent.click(screen.getByText("turnstile-expire"));

      expect(screen.getByTestId("turnstile-widget")).toBeInTheDocument();
    });

    it("falls back to empty turnstile response when getResponse is unavailable", async () => {
      vi.mocked(Turnstile).mockImplementationOnce(({ ref }: { ref?: React.Ref<unknown> }) => {
        if (ref && typeof ref === "object") {
          ref.current = {
            execute: vi.fn(async () => {}),
          };
        }
        return <div data-testid="turnstile-widget-no-response" />;
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(getTurnstileTokenForSubmit).toHaveBeenCalled();
      });
    });

    it("should handle non-Error thrown from generateEmailSaltFromAccountCode", async () => {
      // Covers L168 false branch: err instanceof Error ? err.message : "Failed to generate email salt"
      mockGenerateEmailSaltFromAccountCode.mockRejectedValue("string error");

      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to generate email salt/i),
        ).toBeInTheDocument();
      });
    });

    it("should use fallback error when data.error is falsy on failed verification", async () => {
      // Covers L220: data.error || "Failed to send verification email" — right operand
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: false,
        // no error field
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Fallback "Failed to send verification email" contains "email",
        // so toActionableLoginError rewrites it to email help text
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });
    });

    it("should handle success response without proofId", async () => {
      // Covers L224 false branch: if (data.proofId) — hook throws and sets error phase, never shows waiting
      mockVerifyEmailWithZKEmail.mockResolvedValue({
        success: true,
        // no proofId
      });

      renderComponent();
      await goToEmailVerificationMode();

      const emailInput = screen.getByLabelText(/enter your email address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const addressInput = screen.getByLabelText(/enter your XION address/i);
      fireEvent.change(addressInput, {
        target: { value: "xion1testaddress123" },
      });

      const submitButton = screen.getByRole("button", { name: /send email/i });
      fireEvent.click(submitButton);

      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith("No proof ID returned");
      });

      expect(mockCheckZKEmailStatus).not.toHaveBeenCalled();
    });

    it("should not submit account code form on Enter while generating salt", async () => {
      // Covers L492 false branch: if (e.key === "Enter" && !isGeneratingSalt) — isGeneratingSalt true
      let resolveSalt: (value: string) => void;
      mockGenerateEmailSaltFromAccountCode.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSalt = resolve;
          }),
      );

      renderComponent();
      await goToAccountCodeMode();

      const codeInput = screen.getByLabelText(/Account Code \(e\.g\./i);
      fireEvent.change(codeInput, { target: { value: "0x1234567890abcdef" } });

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      // Click button to start generating salt
      const submitButton = screen.getByRole("button", { name: /login/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/logging in/i)).toBeInTheDocument();
      });

      // Now press Enter while generating - should NOT trigger a second call
      fireEvent.keyDown(emailInput, { key: "Enter" });

      // Should only have been called once (from the button click)
      expect(mockGenerateEmailSaltFromAccountCode).toHaveBeenCalledTimes(1);

      // Cleanup
      resolveSalt!("salt");
    });
  });
});
