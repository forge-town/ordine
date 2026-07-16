import { describe, expect, it } from "vitest";
import type { PipelineAction } from "@repo/schemas";
import { normalizeProposalActionCatalogNames } from "./normalizeProposalActionCatalogNames";

const operationById = new Map([
  ["op-known", { name: "Known Operation" }],
  ["op_new_summarize", { name: "Summarize Notes" }],
]);

const addNodeAction = (operationId: string, operationName: string): PipelineAction => ({
  type: "addNode",
  node: {
    id: "n1",
    type: "operation",
    position: { x: 0, y: 0 },
    data: { nodeType: "operation", label: "Step", operationId, operationName, status: "idle" },
  },
});

describe("normalizeProposalActionCatalogNames", () => {
  it("rewrites addNode operationName to the catalog name", () => {
    const [action] = normalizeProposalActionCatalogNames(
      [addNodeAction("op-known", "wrong name")],
      operationById,
    );

    expect(action).toMatchObject({
      node: { data: { operationId: "op-known", operationName: "Known Operation" } },
    });
  });

  it("rewrites replaceNodeData operationName, including pending op_new_ operations", () => {
    const [action] = normalizeProposalActionCatalogNames(
      [
        {
          type: "replaceNodeData",
          nodeId: "n1",
          data: {
            nodeType: "operation",
            label: "Step",
            operationId: "op_new_summarize",
            operationName: "wrong name",
            status: "idle",
          },
        },
      ],
      operationById,
    );

    expect(action).toMatchObject({
      data: { operationId: "op_new_summarize", operationName: "Summarize Notes" },
    });
  });

  it("leaves actions with unknown operationId untouched", () => {
    const input = [addNodeAction("op-missing", "Missing Operation")];

    expect(normalizeProposalActionCatalogNames(input, operationById)).toEqual(input);
  });
});
