import { describe, expect, it } from "vitest";
import { OperationNodeDataSchema } from "./OperationNodeDataSchema";

const baseOperationNodeData = {
  label: "Review",
  nodeType: "operation",
  operationId: "review",
  operationName: "Review",
  status: "idle",
};

describe("OperationNodeDataSchema", () => {
  it("keeps legacy operation node data compatible without checkpoint", () => {
    const parsed = OperationNodeDataSchema.parse(baseOperationNodeData);

    expect(parsed.checkpoint).toBeUndefined();
  });

  it("parses optional checkpoint state", () => {
    const parsed = OperationNodeDataSchema.parse({
      ...baseOperationNodeData,
      checkpoint: true,
    });

    expect(parsed.checkpoint).toBe(true);
  });
});
