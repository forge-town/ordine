import { describe, expect, it } from "vitest";
import type { FinalConnectionState } from "@xyflow/system";
import { createHarnessCanvasStore } from "./harnessCanvasStore";
import type { PipelineNode } from "./canvasSlice";

const makeNode = (id: string, type: PipelineNode["type"]): PipelineNode =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, nodeType: type },
  }) as PipelineNode;

describe("canvas connection actions", () => {
  it("keeps the dragged source handle when creating a connected node", () => {
    const source = makeNode("source", "operation");
    const target = makeNode("target", "output-local-path");
    const store = createHarnessCanvasStore([source], [], null, "");

    store.getState().handleConnectStart({
      nodeId: source.id,
      handleId: "right-port-2",
      handleType: "source",
    });

    store.getState().addNodeAndAutoConnect(target);

    expect(store.getState().edges).toEqual([
      expect.objectContaining({
        source: source.id,
        sourceHandle: "right-port-2",
        target: target.id,
      }),
    ]);
    expect(store.getState().edges[0]?.targetHandle ?? null).toBeNull();
    expect(store.getState().connectStart).toBeNull();
  });

  it("keeps the dragged target handle when creating a connected upstream node", () => {
    const source = makeNode("source", "folder");
    const target = makeNode("target", "operation");
    const store = createHarnessCanvasStore([target], [], null, "");

    store.getState().handleConnectStart({
      nodeId: target.id,
      handleId: "left-port-1",
      handleType: "target",
    });

    store.getState().addNodeAndAutoConnect(source);

    expect(store.getState().edges).toEqual([
      expect.objectContaining({
        source: source.id,
        target: target.id,
        targetHandle: "left-port-1",
      }),
    ]);
    expect(store.getState().edges[0]?.sourceHandle ?? null).toBeNull();
    expect(store.getState().connectStart).toBeNull();
  });

  it("falls back to the original connect start handle when connect end omits handle id", () => {
    const source = makeNode("source", "operation");
    const store = createHarnessCanvasStore([source], [], null, "");

    store.getState().handleConnectStart({
      nodeId: source.id,
      handleId: "right-port-2",
      handleType: "source",
    });

    store.getState().handleFlowConnectEnd(
      { clientX: 100, clientY: 200 } as MouseEvent,
      {
        isValid: null,
        fromNode: { id: source.id },
        fromHandle: { id: null, type: "source" },
      } as FinalConnectionState
    );

    expect(store.getState().connectStart).toEqual({
      nodeId: source.id,
      handleId: "right-port-2",
      handleType: "source",
    });
    expect(store.getState().connectionMenu).toEqual({
      screenX: 100,
      screenY: 200,
      flowX: 100,
      flowY: 200,
    });
  });
});
