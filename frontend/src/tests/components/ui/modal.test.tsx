import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../..";
import {
  Modal,
  ModalAnchor,
  ModalClose,
  ModalSection,
} from "../../../components/ui/modal";

describe("Modal Components", () => {
  describe("ModalAnchor", () => {
    it("renders children correctly", async () => {
      await render(
        <ModalAnchor>
          <div data-testid="modal-content">Modal Content</div>
        </ModalAnchor>,
      );

      expect(screen.getByTestId("modal-content")).toBeInTheDocument();
    });

    it("applies custom className", async () => {
      await render(
        <ModalAnchor className="custom-anchor-class" data-testid="anchor">
          <div>Content</div>
        </ModalAnchor>,
      );

      const anchor = screen.getByTestId("anchor");
      expect(anchor).toHaveClass("custom-anchor-class");
    });

    it("forwards ref correctly", async () => {
      const ref = React.createRef<HTMLDivElement>();

      await render(
        <ModalAnchor ref={ref}>
          <div>Content</div>
        </ModalAnchor>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("passes additional props", async () => {
      await render(
        <ModalAnchor data-testid="anchor" aria-label="Modal container">
          <div>Content</div>
        </ModalAnchor>,
      );

      const anchor = screen.getByTestId("anchor");
      expect(anchor).toHaveAttribute("aria-label", "Modal container");
    });
  });

  describe("Modal", () => {
    it("renders children correctly", async () => {
      await render(
        <Modal>
          <div data-testid="modal-inner">Inner Content</div>
        </Modal>,
      );

      expect(screen.getByTestId("modal-inner")).toBeInTheDocument();
    });

    it("applies custom className", async () => {
      await render(
        <Modal className="custom-modal-class" data-testid="modal">
          <div>Content</div>
        </Modal>,
      );

      const modal = screen.getByTestId("modal");
      expect(modal).toHaveClass("custom-modal-class");
    });

    it("has default max-width styling", async () => {
      await render(
        <Modal data-testid="modal">
          <div>Content</div>
        </Modal>,
      );

      const modal = screen.getByTestId("modal");
      expect(modal).toHaveClass("ui-max-w-[465px]");
    });

    it("passes additional props", async () => {
      await render(
        <Modal data-testid="modal" role="dialog">
          <div>Content</div>
        </Modal>,
      );

      const modal = screen.getByTestId("modal");
      expect(modal).toHaveAttribute("role", "dialog");
    });
  });

  describe("ModalClose", () => {
    it("renders close button with children", async () => {
      await render(
        <ModalClose>
          <span data-testid="close-icon">×</span>
        </ModalClose>,
      );

      expect(screen.getByTestId("close-icon")).toBeInTheDocument();
    });

    it("applies custom className", async () => {
      await render(
        <ModalClose className="custom-close-class">
          <span>×</span>
        </ModalClose>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-close-class");
    });

    it("handles click events", async () => {
      const handleClick = vi.fn();

      const { user } = await render(
        <ModalClose onClick={handleClick}>
          <span>×</span>
        </ModalClose>,
      );

      await user.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("is positioned absolutely in top-right corner", async () => {
      await render(
        <ModalClose>
          <span>×</span>
        </ModalClose>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("ui-absolute");
      expect(button).toHaveClass("ui-top-4");
      expect(button).toHaveClass("ui-right-4");
    });

    it("has type button", async () => {
      await render(
        <ModalClose>
          <span>×</span>
        </ModalClose>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "button");
    });
  });

  describe("ModalSection", () => {
    it("renders children correctly", async () => {
      await render(
        <ModalSection>
          <div data-testid="section-content">Section Content</div>
        </ModalSection>,
      );

      expect(screen.getByTestId("section-content")).toBeInTheDocument();
    });

    it("applies custom className", async () => {
      await render(
        <ModalSection className="custom-section-class" data-testid="section">
          <div>Content</div>
        </ModalSection>,
      );

      const section = screen.getByTestId("section");
      expect(section).toHaveClass("custom-section-class");
    });

    it("has flexbox layout", async () => {
      await render(
        <ModalSection data-testid="section">
          <div>Content</div>
        </ModalSection>,
      );

      const section = screen.getByTestId("section");
      expect(section).toHaveClass("ui-inline-flex");
      expect(section).toHaveClass("ui-flex-col");
    });

    it("passes additional props", async () => {
      await render(
        <ModalSection data-testid="section" role="region">
          <div>Content</div>
        </ModalSection>,
      );

      const section = screen.getByTestId("section");
      expect(section).toHaveAttribute("role", "region");
    });
  });

  describe("Full Modal Composition", () => {
    it("renders a complete modal structure", async () => {
      const handleClose = vi.fn();

      const { user } = await render(
        <ModalAnchor data-testid="anchor">
          <Modal data-testid="modal">
            <ModalClose onClick={handleClose}>
              <span>×</span>
            </ModalClose>
            <ModalSection data-testid="section">
              <h2>Modal Title</h2>
              <p>Modal Content</p>
            </ModalSection>
          </Modal>
        </ModalAnchor>,
      );

      expect(screen.getByTestId("anchor")).toBeInTheDocument();
      expect(screen.getByTestId("modal")).toBeInTheDocument();
      expect(screen.getByTestId("section")).toBeInTheDocument();
      expect(screen.getByText("Modal Title")).toBeInTheDocument();
      expect(screen.getByText("Modal Content")).toBeInTheDocument();

      await user.click(screen.getByRole("button"));
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
