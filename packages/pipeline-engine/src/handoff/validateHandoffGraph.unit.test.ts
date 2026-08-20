import { describe, expect, it } from "vitest";
import type { OperationInfo } from "../schemas";
import { validateHandoffGraph } from "./validateHandoffGraph";

const sourceOperation: OperationInfo = {
  id: "write-report",
  name: "Write report",
  config: {
    inputs: [],
    outputs: [
      {
        id: "report",
        name: "Report",
        contentType: "markdown",
        produces: ["text/markdown"],
      },
    ],
  },
};

const targetOperation: OperationInfo = {
  id: "render-pdf",
  name: "Render PDF",
  config: {
    inputs: [
      {
        id: "document",
        name: "Document",
        kind: "file",
        required: true,
        accepts: ["text/markdown"],
      },
    ],
    outputs: [],
  },
};

const nodes = [
  {
    id: "write",
    type: "operation" as const,
    position: { x: 0, y: 0 },
    data: {
      label: "Write report",
      nodeType: "operation" as const,
      operationId: "write-report",
      operationName: "Write report",
      status: "idle" as const,
    },
  },
  {
    id: "render",
    type: "operation" as const,
    position: { x: 200, y: 0 },
    data: {
      label: "Render PDF",
      nodeType: "operation" as const,
      operationId: "render-pdf",
      operationName: "Render PDF",
      status: "idle" as const,
    },
  },
];

const handoffEdge = {
  id: "report-to-pdf",
  source: "write",
  target: "render",
  data: {
    label: "",
    handoff: { kind: "handoff" as const, sourcePortId: "report", targetPortId: "document" },
  },
};

describe("validateHandoffGraph", () => {
  it("accepts compatible Operation ports", () => {
    expect(
      validateHandoffGraph({
        nodes,
        edges: [handoffEdge],
        operations: new Map([
          [sourceOperation.id, sourceOperation],
          [targetOperation.id, targetOperation],
        ]),
      }),
    ).toEqual([]);
  });

  it("requires an explicit conversion Operation for incompatible MIME types", () => {
    const incompatibleTarget: OperationInfo = {
      ...targetOperation,
      config: {
        ...targetOperation.config,
        inputs: [{ ...(targetOperation.config.inputs ?? [])[0]!, accepts: ["application/pdf"] }],
      },
    };

    expect(
      validateHandoffGraph({
        nodes,
        edges: [handoffEdge],
        operations: new Map([
          [sourceOperation.id, sourceOperation],
          [incompatibleTarget.id, incompatibleTarget],
        ]),
      }),
    ).toMatchObject([{ edgeId: "report-to-pdf", message: expect.stringContaining("conversion") }]);
  });

  it("rejects multiple handoffs into a one-file input port", () => {
    expect(
      validateHandoffGraph({
        nodes,
        edges: [handoffEdge, { ...handoffEdge, id: "second-report" }],
        operations: new Map([
          [sourceOperation.id, sourceOperation],
          [targetOperation.id, targetOperation],
        ]),
      }),
    ).toMatchObject([{ edgeId: "second-report", message: expect.stringContaining("one handoff") }]);
  });
});
