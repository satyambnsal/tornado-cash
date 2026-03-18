import React from "react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "../..";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../../components/ui/popover";

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("Popover Components", () => {
  describe("Popover", () => {
    it("renders trigger and content when open", async () => {
      const { user } = await render(
        <Popover>
          <PopoverTrigger asChild>
            <button>Open Popover</button>
          </PopoverTrigger>
          <PopoverContent>
            <div data-testid="popover-content">Popover Content</div>
          </PopoverContent>
        </Popover>,
      );

      // Trigger should be visible
      expect(screen.getByText("Open Popover")).toBeInTheDocument();

      // Content should not be visible initially
      expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();

      // Click to open
      await user.click(screen.getByText("Open Popover"));

      // Content should now be visible
      expect(screen.getByTestId("popover-content")).toBeInTheDocument();
    });

    it("closes when trigger is clicked again", async () => {
      const { user } = await render(
        <Popover>
          <PopoverTrigger asChild>
            <button>Toggle Popover</button>
          </PopoverTrigger>
          <PopoverContent>
            <div data-testid="popover-content">Content</div>
          </PopoverContent>
        </Popover>,
      );

      // Open
      await user.click(screen.getByText("Toggle Popover"));
      expect(screen.getByTestId("popover-content")).toBeInTheDocument();

      // Close
      await user.click(screen.getByText("Toggle Popover"));
      expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
    });
  });

  describe("PopoverContent", () => {
    it("applies custom className", async () => {
      const { user } = await render(
        <Popover>
          <PopoverTrigger asChild>
            <button>Open</button>
          </PopoverTrigger>
          <PopoverContent
            className="custom-popover-class"
            data-testid="content"
          >
            Content
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      const content = screen.getByTestId("content");
      expect(content).toHaveClass("custom-popover-class");
    });

    it("has default styling classes", async () => {
      const { user } = await render(
        <Popover>
          <PopoverTrigger asChild>
            <button>Open</button>
          </PopoverTrigger>
          <PopoverContent data-testid="content">Content</PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      const content = screen.getByTestId("content");
      expect(content).toHaveClass("ui-rounded-md");
      expect(content).toHaveClass("ui-text-text-primary");
      expect(content).toHaveClass("ui-z-50");
    });

    it("renders children correctly", async () => {
      const { user } = await render(
        <Popover>
          <PopoverTrigger asChild>
            <button>Open</button>
          </PopoverTrigger>
          <PopoverContent>
            <span data-testid="child-1">Child 1</span>
            <span data-testid="child-2">Child 2</span>
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });

    it("forwards ref correctly", async () => {
      const ref = React.createRef<HTMLDivElement>();

      const { user } = await render(
        <Popover>
          <PopoverTrigger asChild>
            <button>Open</button>
          </PopoverTrigger>
          <PopoverContent ref={ref} data-testid="content">
            Content
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("passes additional props", async () => {
      const { user } = await render(
        <Popover>
          <PopoverTrigger asChild>
            <button>Open</button>
          </PopoverTrigger>
          <PopoverContent data-testid="content" aria-label="Popover menu">
            Content
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      const content = screen.getByTestId("content");
      expect(content).toHaveAttribute("aria-label", "Popover menu");
    });
  });

  describe("PopoverTrigger", () => {
    it("renders as child element when asChild is true", async () => {
      await render(
        <Popover>
          <PopoverTrigger asChild>
            <button data-testid="custom-trigger">Custom Button</button>
          </PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );

      const trigger = screen.getByTestId("custom-trigger");
      expect(trigger.tagName).toBe("BUTTON");
    });
  });
});
