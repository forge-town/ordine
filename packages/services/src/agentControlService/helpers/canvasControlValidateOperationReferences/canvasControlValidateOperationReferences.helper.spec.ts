import { describe, expect, it, vi } from "vitest";
import { createCanvasControlValidateOperationReferencesHelper } from "./canvasControlValidateOperationReferences.helper";

describe("canvasControlValidateOperationReferences", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createCanvasControlValidateOperationReferencesHelper({
      operationsDao: { findById: vi.fn().mockResolvedValue(null) },
    } as never)(
      {
        nodes: [{ id: "node-1", data: { nodeType: "operation", operationId: "missing" } }],
        edges: [],
      } as never,
      "action-1",
    );
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "OPERATION_NOT_FOUND",
      nodeId: "node-1",
    });
  });
});
