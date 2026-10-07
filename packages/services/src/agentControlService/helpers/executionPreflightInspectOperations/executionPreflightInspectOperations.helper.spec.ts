import { describe, expect, it, vi } from "vitest";
import { createExecutionPreflightInspectOperationsHelper } from "./executionPreflightInspectOperations.helper";
import { ok } from "neverthrow";

describe("executionPreflightInspectOperations", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createExecutionPreflightInspectOperationsHelper({
      operationsDao: { findById: vi.fn().mockResolvedValue(null) },
      capabilityCatalog: { getMany: vi.fn().mockResolvedValue(ok([])) },
    } as never)(["missing"]);
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "OPERATION_NOT_FOUND",
      field: "operationId",
    });
  });
});
