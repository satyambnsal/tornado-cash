import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { render, screen, waitFor } from "../..";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../../../components/ui/dialog";

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Mock MutationObserver
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

afterEach(() => {
  vi.clearAllTimers();
});

describe("Dialog Components", () => {
  describe("Dialog", () => {
    it("renders trigger and opens dialog on click", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open Dialog</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByText("Open Dialog")).toBeInTheDocument();
      expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument();

      await user.click(screen.getByText("Open Dialog"));

      await waitFor(() => {
        expect(screen.getByText("Dialog Title")).toBeInTheDocument();
      });
    });
  });

  describe("DialogContent", () => {
    it("renders children correctly", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <div data-testid="content">Test Content</div>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("content")).toBeInTheDocument();
      });
    });

    it("renders close button when closeButton prop is true", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent closeButton>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByLabelText("Close dialog")).toBeInTheDocument();
      });
    });

    it("applies custom className", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent className="custom-dialog-class">
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveClass("custom-dialog-class");
      });
    });

    it("closes when close button is clicked", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent closeButton>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText("Close dialog"));

      await waitFor(() => {
        expect(screen.queryByText("Title")).not.toBeInTheDocument();
      });
    });

    it("renders with overApp prop", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent overApp>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });
  });

  describe("DialogHeader", () => {
    it("renders children correctly", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader data-testid="header">
              <DialogTitle>Header Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("header")).toBeInTheDocument();
        expect(screen.getByText("Header Title")).toBeInTheDocument();
      });
    });

    it("applies custom className", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader className="custom-header-class" data-testid="header">
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("header")).toHaveClass("custom-header-class");
      });
    });
  });

  describe("DialogFooter", () => {
    it("renders children correctly", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter data-testid="footer">
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("footer")).toBeInTheDocument();
        expect(screen.getByText("Cancel")).toBeInTheDocument();
        expect(screen.getByText("Confirm")).toBeInTheDocument();
      });
    });

    it("applies custom className", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter className="custom-footer-class" data-testid="footer">
              <button>OK</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("footer")).toHaveClass("custom-footer-class");
      });
    });
  });

  describe("DialogTitle", () => {
    it("renders title text", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>My Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("My Dialog Title")).toBeInTheDocument();
      });
    });

    it("applies custom className", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle className="custom-title-class" data-testid="title">
              Title
            </DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("title")).toHaveClass("custom-title-class");
      });
    });
  });

  describe("DialogDescription", () => {
    it("renders description text", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>This is a description</DialogDescription>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("This is a description")).toBeInTheDocument();
      });
    });

    it("applies custom className", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription className="custom-desc-class" data-testid="desc">
              Description
            </DialogDescription>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("desc")).toHaveClass("custom-desc-class");
      });
    });
  });

  describe("DialogOverlay", () => {
    it("renders with decorative blurs when overApp is false", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("renders without decorative blurs when overApp is true", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent overApp>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });
  });

  describe("DialogClose", () => {
    it("closes dialog when clicked", async () => {
      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogClose asChild>
              <button data-testid="close-btn">Close</button>
            </DialogClose>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("close-btn"));

      await waitFor(() => {
        expect(screen.queryByText("Title")).not.toBeInTheDocument();
      });
    });
  });

  describe("Full Dialog Composition", () => {
    it("renders complete dialog with all components", async () => {
      const handleClose = vi.fn();

      const { user } = await render(
        <Dialog>
          <DialogTrigger asChild>
            <button>Open Full Dialog</button>
          </DialogTrigger>
          <DialogContent closeButton>
            <DialogHeader>
              <DialogTitle>Complete Dialog</DialogTitle>
              <DialogDescription>
                This is a complete dialog with all components
              </DialogDescription>
            </DialogHeader>
            <div>Main content area</div>
            <DialogFooter>
              <DialogClose asChild>
                <button onClick={handleClose}>Cancel</button>
              </DialogClose>
              <button>Submit</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open Full Dialog"));

      await waitFor(() => {
        expect(screen.getByText("Complete Dialog")).toBeInTheDocument();
        expect(
          screen.getByText("This is a complete dialog with all components"),
        ).toBeInTheDocument();
        expect(screen.getByText("Main content area")).toBeInTheDocument();
        expect(screen.getByText("Cancel")).toBeInTheDocument();
        expect(screen.getByText("Submit")).toBeInTheDocument();
      });
    });
  });
});
