import React from "react";
import { render as rtlRender, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

// Custom render function that can be extended with providers if needed
async function render(ui: React.ReactElement, options = {}) {
  const user = userEvent.setup({
    delay: null, // Disable artificial delay for faster tests
  });

  return {
    user,
    click: (element: Element) => fireEvent.click(element),
    ...rtlRender(ui, {
      ...options,
    }),
  };
}

// ========== COMPONENT TESTING UTILITIES ==========

/**
 * Tests common component props that most UI components should handle correctly
 * @param Component The component to test
 * @param defaultProps Default props required by the component
 * @param testId The data-testid to use for finding the component
 */
export function testCommonComponentProps<P>(
  Component: React.ComponentType<P>,
  defaultProps: Partial<P> = {},
  testId: string = "component",
) {
  describe("Common Component Behavior", () => {
    it("applies custom className", async () => {
      await render(
        <Component
          {...(defaultProps as P)}
          className="custom-class"
          data-testid={testId}
        />,
      );
      expect(screen.getByTestId(testId)).toHaveClass("custom-class");
    });

    it("passes through additional HTML props", async () => {
      await render(
        <Component
          {...(defaultProps as P)}
          data-testid={testId}
          aria-label="Test label"
          data-custom="custom-value"
        />,
      );
      const element = screen.getByTestId(testId);
      expect(element).toHaveAttribute("aria-label", "Test label");
      expect(element).toHaveAttribute("data-custom", "custom-value");
    });
  });
}

/**
 * Tests ref forwarding for components
 * @param Component The component to test
 * @param defaultProps Default props required by the component
 * @param elementType The expected HTML element type (e.g., HTMLButtonElement)
 */
export function testRefForwarding<P>(
  Component: React.ComponentType<P>,
  defaultProps: Partial<P> = {},
  elementType: typeof HTMLElement = HTMLElement,
) {
  it("forwards ref correctly", async () => {
    const ref = React.createRef<HTMLElement>();
    await render(<Component {...(defaultProps as P)} ref={ref} />);
    expect(ref.current).toBeInstanceOf(elementType);
  });
}

// ========== FORM TESTING UTILITIES ==========

/**
 * Tests common form input behavior
 * @param Component The input component to test
 * @param defaultProps Default props required by the component
 */
export function testFormInputBehavior<P>(
  Component: React.ComponentType<P>,
  defaultProps: Partial<P> = {},
) {
  describe("Form Input Behavior", () => {
    it("handles value changes", async () => {
      const handleChange = vi.fn();
      const { user } = await render(
        <Component {...(defaultProps as P)} onChange={handleChange} />,
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "test value");

      expect(handleChange).toHaveBeenCalled();
    });

    it("handles focus and blur events", async () => {
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();

      const { user } = await render(
        <Component
          {...(defaultProps as P)}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      expect(handleFocus).toHaveBeenCalled();

      await user.tab();
      expect(handleBlur).toHaveBeenCalled();
    });
  });
}

// ========== MOCK UTILITIES ==========

/**
 * Creates a mock for localStorage
 * @returns A mock localStorage object
 */
export function createLocalStorageMock() {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  Object.defineProperty(window, "localStorage", { value: localStorageMock });

  return localStorageMock;
}

/**
 * Mocks environment variables
 * @param envVars Object containing environment variables to mock
 */
export function mockEnvironmentVariables(envVars: Record<string, string>) {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.entries(envVars).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });
  });

  afterEach(() => {
    // Restore original env vars
    Object.keys(envVars).forEach((key) => {
      if (originalEnv[key]) {
        vi.stubEnv(key, originalEnv[key]);
      } else {
        // Reset the environment variable
        vi.stubEnv(key, "");
      }
    });
  });
}

export * from "@testing-library/react";
export { render };
