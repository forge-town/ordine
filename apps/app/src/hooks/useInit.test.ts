import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInit } from "./useInit";
import { useBeginning } from "./useBeginning";

describe("useBeginning", () => {
  it("calls the callback only on first render", () => {
    const cb = vi.fn(() => 42);
    const { rerender } = renderHook(() => useBeginning(cb));
    expect(cb).toHaveBeenCalledTimes(1);
    rerender();
    rerender();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("returns the callback result on first render", () => {
    const { result } = renderHook(() => useBeginning(() => "hello"));
    expect(result.current).toBe("hello");
  });

  it("returns undefined on subsequent renders", () => {
    const counter = { value: 0 };
    const { result, rerender } = renderHook(() =>
      useBeginning(() => {
        counter.value++;
        return counter.value;
      })
    );
    expect(result.current).toBe(1);
    rerender();
    expect(result.current).toBeUndefined();
  });
});

describe("useInit", () => {
  it("returns the initialized value", () => {
    const { result } = renderHook(() => useInit(() => ({ name: "test" })));
    expect(result.current).toEqual({ name: "test" });
  });

  it("returns the same reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useInit(() => ({ value: 99 })));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("never calls the factory more than once", () => {
    const factory = vi.fn(() => "singleton");
    const { rerender } = renderHook(() => useInit(factory));
    rerender();
    rerender();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
