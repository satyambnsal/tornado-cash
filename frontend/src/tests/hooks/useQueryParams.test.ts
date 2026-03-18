import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useQueryParams } from "../../hooks/useQueryParams";

describe("useQueryParams", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: {
        ...originalLocation,
        search: "",
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: originalLocation,
    });
  });

  it("should return empty object when no params are present", () => {
    const { result } = renderHook(() => useQueryParams(["param1", "param2"]));
    expect(result.current).toEqual({
      param1: null,
      param2: null,
    });
  });

  it("should return correct values for present params", () => {
    window.location.search = "?param1=value1&param2=value2";
    const { result } = renderHook(() => useQueryParams(["param1", "param2"]));
    expect(result.current).toEqual({
      param1: "value1",
      param2: "value2",
    });
  });

  it("should ignore params not in the list", () => {
    window.location.search = "?param1=value1&other=value3";
    const { result } = renderHook(() => useQueryParams(["param1"]));
    expect(result.current).toEqual({
      param1: "value1",
    });
  });

  it("should update when popstate event occurs", () => {
    window.location.search = "?param1=initial";
    const { result } = renderHook(() => useQueryParams(["param1"]));

    expect(result.current.param1).toBe("initial");

    act(() => {
      window.location.search = "?param1=updated";
      window.dispatchEvent(new Event("popstate"));
    });

    expect(result.current.param1).toBe("updated");
  });
});
