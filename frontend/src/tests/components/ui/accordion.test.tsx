import React from "react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../../../components/ui/accordion";

// Mock ResizeObserver for Radix
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

describe("Accordion", () => {
  it("renders all items", async () => {
    await render(
      <Accordion type="multiple">
        <AccordionItem value="item-1">
          <AccordionTrigger>Item 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Item 2</AccordionTrigger>
          <AccordionContent>Content 2</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("does not show content initially", async () => {
    await render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Expandable</AccordionTrigger>
          <AccordionContent>Hidden Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
  });

  it("shows content when trigger is clicked", async () => {
    await render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Expandable</AccordionTrigger>
          <AccordionContent>Visible Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    await userEvent.click(screen.getByText("Expandable"));
    expect(screen.getByText("Visible Content")).toBeInTheDocument();
  });

  it("renders chevron icon in trigger", async () => {
    await render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>With Chevron</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.getByTestId("chevron-down-icon")).toBeInTheDocument();
  });

  it("allows multiple items to be open simultaneously", async () => {
    await render(
      <Accordion type="multiple">
        <AccordionItem value="item-1">
          <AccordionTrigger>Item 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Item 2</AccordionTrigger>
          <AccordionContent>Content 2</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    await userEvent.click(screen.getByText("Item 1"));
    await userEvent.click(screen.getByText("Item 2"));

    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("applies custom className to AccordionItem", async () => {
    await render(
      <Accordion type="single" collapsible>
        <AccordionItem
          value="item-1"
          className="custom-class"
          data-testid="item"
        >
          <AccordionTrigger>Item</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.getByTestId("item")).toHaveClass("custom-class");
  });
});
