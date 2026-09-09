import { describe, expect, it } from "vitest";
import { createCanvasPageStore } from "../_store/canvasPageStore";
import type { PipelineNode } from "../_store/canvasSlice";
import { decorateEdgesWithPortHandles } from "./nodePorts";

const nodes = [
  {
    id: "prompt",
    type: "prompt",
    position: { x: 0, y: 0 },
    data: { label: "Prompt", nodeType: "prompt", prompt: "Input" },
  },
  {
    id: "operation",
    type: "operation",
    position: { x: 250, y: 0 },
    data: {
      label: "Operation",
      nodeType: "operation",
      operationId: "op",
      operationName: "Operation",
      status: "idle",
    },
  },
  {
    id: "output",
    type: "output-local-path",
    position: { x: 500, y: 0 },
    data: {
      label: "Output",
      nodeType: "output-local-path",
      localPath: "",
      outputFileName: "result.txt",
      outputMode: "overwrite",
    },
  },
] as PipelineNode[];
describe("Canvas explicit semantic handoffs", () => {
  it("records the exact dragged Operation ports and keeps them stable after node movement", () => {
    const store = createCanvasPageStore(nodes, []);
    store.getState().handleConnect({
      source: "prompt",
      sourceHandle: "output:output",
      target: "operation",
      targetHandle: "input:second-input",
    });
    store.getState().handleConnect({
      source: "operation",
      sourceHandle: "output:third-output",
      target: "output",
      targetHandle: "input:input",
    });
    expect(store.getState().edges.map((edge) => edge.data?.handoff)).toEqual([
      { kind: "handoff", sourcePortId: "output", targetPortId: "second-input" },
      { kind: "handoff", sourcePortId: "third-output", targetPortId: "input" },
    ]);
    const moved = nodes.map((node) => ({
      ...node,
      position: { x: node.position.x, y: 800 - node.position.x },
    }));
    expect(
      decorateEdgesWithPortHandles(moved, store.getState().edges).map((edge) => [
        edge.sourceHandle,
        edge.targetHandle,
      ]),
    ).toEqual([
      ["output:output", "input:second-input"],
      ["output:third-output", "input:input"],
    ]);
  });
  it("refuses geometric handles instead of inferring Operation port ids", () => {
    const store = createCanvasPageStore(nodes, []);
    store.getState().handleConnect({
      source: "prompt",
      sourceHandle: "right-port-0",
      target: "operation",
      targetHandle: "left-port-0",
    });
    expect(store.getState().edges).toHaveLength(0);
  });
});
