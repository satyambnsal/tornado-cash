import { describe, it, expect } from "vitest";
import { createStytchMock, fillOtpInputs } from "./auth-utils";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("auth-utils", () => {
  describe("createStytchMock", () => {
    it("should return a stytch mock object with expected structure", () => {
      const mock = createStytchMock();

      expect(mock.oauth.google.start).toBeDefined();
      expect(mock.otps.email.loginOrCreate).toBeDefined();
      expect(mock.otps.authenticate).toBeDefined();
      expect(mock.session.getSync).toBeDefined();
      expect(mock.session.authenticate).toBeDefined();
      expect(mock.webauthn.register.start).toBeDefined();
      expect(mock.webauthn.register.authenticate).toBeDefined();
    });

    it("should have working mock functions", async () => {
      const mock = createStytchMock();

      await expect(mock.oauth.google.start()).resolves.toBeUndefined();

      const loginRes = await mock.otps.email.loginOrCreate();
      expect(loginRes).toEqual({
        method_id: "test-method-id",
        status_code: 200,
      });

      const authRes = await mock.otps.authenticate();
      expect(authRes.session.session_token).toBe("test-session-token");
    });
  });

  describe("fillOtpInputs", () => {
    it("should fill otp inputs", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <input type="number" aria-label="otp-1" />
          <input type="number" aria-label="otp-2" />
          <input type="number" aria-label="otp-3" />
        </div>,
      );

      // We need to mock screen.getAllByRole inside the test context if we were testing the implementation details,
      // but here we are testing the helper itself using real DOM elements.
      // However, fillOtpInputs uses `screen.getAllByRole("spinbutton")`.
      // <input type="number"> has role "spinbutton".

      await fillOtpInputs(user, "123");

      const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
      expect(inputs[0].value).toBe("1");
      expect(inputs[1].value).toBe("2");
      expect(inputs[2].value).toBe("3");
    });

    it("should handle default code", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <input type="number" />
          <input type="number" />
          <input type="number" />
          <input type="number" />
          <input type="number" />
          <input type="number" />
        </div>,
      );

      await fillOtpInputs(user);

      const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
      expect(inputs[0].value).toBe("1");
      expect(inputs[5].value).toBe("6");
    });
  });
});
