import { describe, expect, it, vi } from "vitest";
import { createStartMethod } from "./start.method";

describe("start", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const initializeRun = vi.fn();
    const start = createStartMethod({
      admission: { open: false },
      AdmissionClosedError: class extends Error {
        constructor() {
          super("shutting down");
        }
      },
      initializeRun,
      startingRuns: new Set(),
    } as never);
    await expect(start({} as never)).rejects.toThrow("shutting down");
    expect(initializeRun).not.toHaveBeenCalled();
  });
});
