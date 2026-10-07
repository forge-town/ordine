import { describe, expect, it, vi } from "vitest";
import { createExecutionPreflightRoutineMethod } from "./executionPreflightRoutine.method";

describe("executionPreflightRoutine", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createExecutionPreflightRoutineMethod({
      routinesDao: { findById: vi.fn().mockResolvedValue(null) },
    } as never)("missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "ROUTINE_NOT_FOUND",
      field: "routineId",
    });
  });
});
