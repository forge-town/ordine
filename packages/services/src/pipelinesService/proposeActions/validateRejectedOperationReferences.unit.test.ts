import { describe, expect, it } from "vitest";
import type { PipelineAction } from "@repo/schemas";
import { validateRejectedOperationReferences } from "./validateRejectedOperationReferences";

const addNodeAction = (operationId: string): PipelineAction => ({
  type: "addNode",
  node: {
    id: "n1",
    type: "operation",
    position: { x: 0, y: 0 },
    data: {
      nodeType: "operation",
      label: "Step",
      operationId,
      operationName: "Step Name",
      status: "idle",
    },
  },
});

const replaceNodeDataAction = (operationId: string): PipelineAction => ({
  type: "replaceNodeData",
  nodeId: "n1",
  data: {
    nodeType: "operation",
    label: "Step",
    operationId,
    operationName: "Step Name",
    status: "idle",
  },
});

describe("validateRejectedOperationReferences", () => {
  it("returns empty diagnostics when there are no rejected ids", () => {
    expect(validateRejectedOperationReferences([addNodeAction("op_known")], [])).toEqual([]);
  });

  it("returns empty diagnostics when no action references a rejected id", () => {
    expect(
      validateRejectedOperationReferences(
        [addNodeAction("op_known"), replaceNodeDataAction("op_other")],
        ["op_rejected"],
      ),
    ).toEqual([]);
  });

  it("emits an error diagnostic for addNode actions referencing a rejected id", () => {
    const diagnostics = validateRejectedOperationReferences(
      [addNodeAction("op_rejected")],
      ["op_rejected"],
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        actionIndex: 0,
        code: "INVALID_NODE_DATA",
        severity: "error",
        message: expect.stringContaining('"op_rejected"'),
      }),
    ]);
  });

  it("emits an error diagnostic for replaceNodeData actions referencing a rejected id", () => {
    const diagnostics = validateRejectedOperationReferences(
      [replaceNodeDataAction("op_rejected")],
      ["op_rejected"],
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        actionIndex: 0,
        code: "INVALID_NODE_DATA",
        severity: "error",
        message: expect.stringContaining('"op_rejected"'),
      }),
    ]);
  });

  it("reports the correct actionIndex in a mixed action list", () => {
    const diagnostics = validateRejectedOperationReferences(
      [
        addNodeAction("op_ok"),
        addNodeAction("op_rejected"),
        addNodeAction("op_ok2"),
        replaceNodeDataAction("op_rejected"),
      ],
      ["op_rejected"],
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]?.actionIndex ?? -1).toBe(1);
    expect(diagnostics[1]?.actionIndex ?? -1).toBe(3);
  });

  it("ignores non-operation actions", () => {
    const removeAction: PipelineAction = {
      type: "removeNode",
      nodeId: "n1",
    };

    expect(validateRejectedOperationReferences([removeAction], ["op_rejected"])).toEqual([]);
  });
});
