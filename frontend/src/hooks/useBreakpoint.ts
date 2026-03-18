import { useEffect, useCallback, useState } from "react";

/** Tailwind's default breakpoint keys */
type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

/** Pixel values for the corresponding breakpoints */
const breakpoints = {
  sm: 640, // @media (min-width: 640px)
  md: 768, // @media (min-width: 768px)
  lg: 1024, // @media (min-width: 1024px)
  xl: 1280, // @media (min-width: 1280px)
  "2xl": 1536, // @media (min-width: 1536px)
} as const;

const RESIZE_DEBOUNCE_MS = 150;

/**
 * Tracks window width against a breakpoint with debounced resize handling.
 *
 * @param breakpoint - Target breakpoint to check against
 * @returns True if window width is >= breakpoint
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isDesktop = useBreakpoint('lg');
 *
 *   return isDesktop ? <DesktopView /> : <MobileView />;
 * }
 * ```
 */
export function useBreakpoint(breakpoint: Breakpoint) {
  // Validate breakpoint exists
  if (!breakpoints[breakpoint]) {
    throw new Error(`Invalid breakpoint: ${breakpoint}`);
  }

  // Helper to check if window width exceeds breakpoint
  const getIsAboveBreakpoint = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= breakpoints[breakpoint];
  }, [breakpoint]);

  // Track state of window width vs breakpoint
  const [isAboveBreakpoint, setIsAboveBreakpoint] =
    useState(getIsAboveBreakpoint);

  // Update state when window is resized
  const handleResize = useCallback(() => {
    setIsAboveBreakpoint(getIsAboveBreakpoint());
  }, [getIsAboveBreakpoint]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: number;

    // Debounce resize events to prevent excessive updates
    const debouncedResize = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(handleResize, RESIZE_DEBOUNCE_MS);
    };

    // Set initial value and attach listener
    handleResize();
    window.addEventListener("resize", debouncedResize, { passive: true });

    // Cleanup listener and any pending timeouts
    return () => {
      window.removeEventListener("resize", debouncedResize);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [handleResize]);

  return isAboveBreakpoint;
}
