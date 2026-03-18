import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "../../..";
import { Dialog, DialogContent } from "../../../../components/ui/dialog";
import { AddZKEmail } from "../../../../components/ModalViews/AddAuthenticators/AddZKEmail";
import { useZKEmailVerificationFlow } from "../../../../hooks/useZKEmailVerificationFlow";
import { proofResponseToBase64Signature } from "../../../../auth/utils/zk-email";

vi.mock("../../../../hooks/useZKEmailVerificationFlow", () => ({
  useZKEmailVerificationFlow: vi.fn(),
}));

vi.mock("../../../../config", () => ({
  TURNSTILE_SITE_KEY: "",
  IS_DEV: false,
}));

vi.mock("../../../../utils/turnstile", () => ({
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

vi.mock("../../../../auth/utils/zk-email", () => ({
  getZKEmailStatusMessage: vi.fn((status: string) => `Status: ${status}`),
  ZK_EMAIL_STATUS: {
    email_sent_awaiting_reply: "email_sent_awaiting_reply",
    email_replied: "email_replied",
  },
  encodeBase64Url: vi.fn((v: string) => `b64:${v}`),
  proofResponseToBase64Signature: vi.fn(),
}));

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

describe("AddZKEmail branch edges", () => {
  const onSubmit = vi.fn();
  const onError = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
    } as unknown as ReturnType<typeof useZKEmailVerificationFlow>);

    const { user } = await render(
      <Dialog open={true}>
        <DialogContent>
          <AddZKEmail
            onSubmit={onSubmit}
            onError={onError}
            onClose={onClose}
            abstractAccount={{ id: "xion1testaddress123" }}
          />
        </DialogContent>
      </Dialog>,
    );

    await user.type(screen.getByRole("textbox"), "user@example.com");
    fireEvent.click(screen.getByRole("button", { name: /send verification email/i }));

    await waitFor(() => {
      expect(startVerification).toHaveBeenCalledTimes(1);
    });
    expect(capturedTokens).toEqual(["mock-turnstile-token"]);
  });

  it("uses fallback non-Error message when signature preparation throws non-Error", async () => {
    vi.mocked(proofResponseToBase64Signature).mockImplementation(() => {
      throw "bad-signature";
    });
    vi.mocked(useZKEmailVerificationFlow).mockReturnValue({
      phase: "success",
      currentStatus: null,
      error: null,
      isProcessing: false,
      verificationResult: { proof: { publicInputs: [] } },
      startVerification: vi.fn(),
    } as unknown as ReturnType<typeof useZKEmailVerificationFlow>);

    render(
      <Dialog open={true}>
        <DialogContent>
          <AddZKEmail
            onSubmit={onSubmit}
            onError={onError}
            onClose={onClose}
            abstractAccount={{ id: "xion1testaddress123" }}
          />
        </DialogContent>
      </Dialog>,
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Failed to prepare signature");
    });
  });
});
