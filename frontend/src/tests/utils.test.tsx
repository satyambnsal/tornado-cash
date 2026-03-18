import { describe, it, expect, vi } from "vitest";
import {
  render as customRender,
  mockEnvironmentVariables,
  testCommonComponentProps,
  testRefForwarding,
  testFormInputBehavior,
  createLocalStorageMock,
} from "./utils";
import React, { forwardRef } from "react";
import { screen } from "@testing-library/react";

describe("utils.tsx", () => {
  describe("render helper", () => {
    it("provides a click helper that fires click events", async () => {
      const handleClick = vi.fn();
      const TestComponent = () => (
        <button onClick={handleClick}>Click me</button>
      );

      const { click } = await customRender(<TestComponent />);
      const button = screen.getByText("Click me");

      click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("mockEnvironmentVariables", () => {
    describe("restoring existing variables", () => {
      const VAR_NAME = "NODE_ENV";

      mockEnvironmentVariables({
        [VAR_NAME]: "mocked_value",
      });

      it("mocks the variable", () => {
        expect(process.env[VAR_NAME]).toBe("mocked_value");
      });
    });

    describe("restoring non-existing variables", () => {
      const VAR_NAME = "NON_EXISTENT_VAR_XYZ";

      mockEnvironmentVariables({
        [VAR_NAME]: "mocked_value",
      });

      it("mocks the variable", () => {
        expect(process.env[VAR_NAME]).toBe("mocked_value");
      });
    });
  });

  describe("Component Testing Utilities", () => {
    const TestComponent = forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => (
      <div ref={ref} {...props}>
        Test
      </div>
    ));
    TestComponent.displayName = "TestComponent";

    describe("testCommonComponentProps", () => {
      testCommonComponentProps(TestComponent);
    });

    describe("testRefForwarding", () => {
      testRefForwarding(TestComponent, {}, HTMLDivElement);
    });
  });

  describe("Form Testing Utilities", () => {
    const TestInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />;

    describe("testFormInputBehavior", () => {
      testFormInputBehavior(TestInput);
    });
  });

  describe("createLocalStorageMock", () => {
    it("creates a working localStorage mock", () => {
      const mock = createLocalStorageMock();

      expect(window.localStorage).toBe(mock);
      expect(mock.getItem).toBeDefined();
      expect(mock.setItem).toBeDefined();
      expect(mock.removeItem).toBeDefined();
      expect(mock.clear).toBeDefined();
      expect(mock.key).toBeDefined();
      expect(mock.length).toBe(0);
    });
  });
});
