import React from "react";
import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { render } from "../../utils";

/**
 * Test utility for button components
 * @param ButtonComponent The button component to test
 * @param defaultProps Default props required by the component
 * @param buttonText Text content to look for in the button
 */
export function testButtonComponent<P>(
  ButtonComponent: React.ComponentType<P>,
  defaultProps: Partial<P> = {},
  buttonText: string,
) {
  describe("Button Component Tests", () => {
    it("renders with text content", async () => {
      await render(
        <ButtonComponent {...(defaultProps as P)}>
          {buttonText}
        </ButtonComponent>,
      );
      expect(screen.getByText(buttonText)).toBeInTheDocument();
    });

    it("handles click events", async () => {
      const handleClick = vi.fn();
      const { user } = await render(
        <ButtonComponent {...(defaultProps as P)} onClick={handleClick}>
          {buttonText}
        </ButtonComponent>,
      );

      await user.click(screen.getByText(buttonText));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies disabled state correctly", async () => {
      await render(
        <ButtonComponent {...(defaultProps as P)} disabled>
          {buttonText}
        </ButtonComponent>,
      );

      const button = screen.getByText(buttonText).closest("button");
      expect(button).toBeDisabled();
    });
  });
}

/**
 * Test utility for checking component variants
 * @param Component The component to test
 * @param defaultProps Default props required by the component
 * @param variants Object mapping variant names to expected class names
 * @param propName The prop name used for variants (default: 'variant')
 */
export function testComponentVariants<P>(
  Component: React.ComponentType<P>,
  defaultProps: Partial<P> = {},
  variants: Record<string, string[]>,
  propName: string = "variant",
) {
  describe("Component Variants", () => {
    Object.entries(variants).forEach(([variantName, expectedClasses]) => {
      it(`applies ${variantName} variant styles correctly`, async () => {
        const variantProp = { [propName]: variantName };
        await render(
          <Component
            {...(defaultProps as P)}
            {...variantProp}
            data-testid="component"
          />,
        );

        const component = screen.getByTestId("component");
        expectedClasses.forEach((className) => {
          expect(component).toHaveClass(className);
        });
      });
    });
  });
}
