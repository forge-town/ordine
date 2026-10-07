import { describe, expect, it, vi } from "vitest";
import { createExecuteMethod } from "./execute.method";

describe("execute", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const stored = { id: "run-1", status: "completed" };
    const result = { id: "run-1", resultText: "done" };
    const execute = createExecuteMethod({
      startInternal: vi.fn().mockResolvedValue({ runId: "run-1" }),
      executions: new Map(),
      getRunRecord: vi.fn().mockResolvedValue(stored),
      getPublicRun: vi.fn().mockResolvedValue(result),
    } as never);
    expect(await execute({} as never)).toEqual(result);
  });
});
