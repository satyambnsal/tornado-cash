import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "../..";
import { Dialog, DialogContent } from "../../../components/ui/dialog";
import { ZKEmailLogin } from "../../../components/LoginScreen/ZKEmailLogin";
import { useZKEmailVerificationFlow } from "../../../hooks/useZKEmailVerificationFlow";

vi.mock("../../../hooks/useZKEmailVerificationFlow", () => ({
  useZKEmailVerificationFlow: vi.fn(),
}));

vi.mock("../../../config", () => ({
  TURNSTILE_SITE_KEY: "",
  IS_DEV: false,
}));

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
      return getRefToken() || getResponse() || "mock-turnstile-token";
    },
  ),
}));

vi.mock("../../../auth/utils/zk-email", () => ({
  extractEmailSalt: vi.fn(() => "salt"),
  generateEmailSaltFromAccountCode: vi.fn(),
  getZKEmailStatusMessage: vi.fn((status: string) => `Status: ${status}`),
  isValidZKEmailFormat: vi.fn(() => true),
  ZK_EMAIL_STATUS: {
    email_sent_awaiting_reply: "email_sent_awaiting_reply",
    email_replied: "email_replied",
  },
}));

vi.mock("@burnt-labs/signers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@burnt-labs/signers")>();
  return {
    ...actual,
    isValidHex: vi.fn(() => true),
    normalizeHexPrefix: vi.fn((v: string) => v),
    validateBech32Address: vi.fn(),
  };
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
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

describe("ZKEmailLogin branch edges", () => {
  const onLogin = vi.fn();
  const onCancel = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows polling fallback description when status is null", () => {
    vi.mocked(useZKEmailVerificationFlow).mockReturnValue({
      phase: "polling",
      currentStatus: null,
      error: null,
      isProcessing: true,
      verificationResult: null,
      startVerification: vi.fn(),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useZKEmailVerificationFlow>);

    render(
      <Dialog open={true}>
        <DialogContent>
          <ZKEmailLogin onLogin={onLogin} onCancel={onCancel} onError={onError} />
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText(/Get my Account Code via Email/i));
    expect(screen.getAllByText("Processing verification...").length).toBeGreaterThan(
      0,
    );
  });

  it("renders form error block when flowError exists in form phase", () => {
    vi.mocked(useZKEmailVerificationFlow).mockReturnValue({
      phase: "form",
      currentStatus: null,
      error: "form-level error",
      isProcessing: false,
      verificationResult: null,
      startVerification: vi.fn(),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useZKEmailVerificationFlow>);

    render(
      <Dialog open={true}>
        <DialogContent>
          <ZKEmailLogin onLogin={onLogin} onCancel={onCancel} onError={onError} />
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText(/Get my Account Code via Email/i));
    expect(screen.getByText("form-level error")).toBeInTheDocument();
  });

  it("uses turnstile fallback token when ref is null", async () => {
    const capturedTokens: string[] = [];
    const startVerification = vi.fn(async (params: { getTurnstileToken: () => Promise<string> }) => {
      const token = await params.getTurnstileToken();
      capturedTokens.push(token);
    });
    vi.mocked(useZKEmailVerificationFlow).mockReturnValue({
      phase: "form",
      currentStatus: null,
      error: null,
      isProcessing: false,
      verificationResult: null,
      startVerification,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useZKEmailVerificationFlow>);

    const { user } = await render(
      <Dialog open={true}>
        <DialogContent>
          <ZKEmailLogin onLogin={onLogin} onCancel={onCancel} onError={onError} />
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText(/Get my Account Code via Email/i));

    const emailInput = screen.getByLabelText(/enter your email address/i);
    const addressInput = screen.getByLabelText(/enter your XION address/i);
    await user.type(emailInput, "user@example.com");
    await user.type(addressInput, "xion1testaddress123");
    fireEvent.click(screen.getByRole("button", { name: /send email/i }));

    await waitFor(() => {
      expect(startVerification).toHaveBeenCalledTimes(1);
    });
    expect(capturedTokens).toEqual(["mock-turnstile-token"]);
  });
});
