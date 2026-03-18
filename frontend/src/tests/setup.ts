import "@testing-library/jest-dom/vitest";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { configure } from "@testing-library/react";


configure({
  asyncUtilTimeout: 1000,
});

// input-otp library uses document.elementFromPoint which jsdom doesn't support
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

declare module "vitest" {
  interface Assertion<T> {
    toHaveClass: (className: string) => T;
    toBeInTheDocument: () => T;
    // Using unknown[] to match Vitest's internal type definition
    toHaveBeenCalledExactlyOnceWith: <E extends unknown[]>(...args: E) => void;
  }
}
