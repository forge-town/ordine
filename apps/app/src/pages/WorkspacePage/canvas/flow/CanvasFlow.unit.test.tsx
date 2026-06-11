import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  encodeCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { CanvasFlow } from "./CanvasFlow";

type ReactFlowProps = {
  onNodesChange?: (changes: unknown[]) => void;
  onPaneClick?: () => void;
  onSelectionChange?: (selection: { edges: { id: string }[]; nodes: { id: string }[] }) => void;
};

const hotkeyHandlers = new Map<string, () => void>();
let latestReactFlowProps: ReactFlowProps | null = null;

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: (keys: string, handler: () => void) => {
    hotkeyHandlers.set(keys, handler);
  },
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: ReactFlowProps & { children?: React.ReactNode }) => {
    latestReactFlowProps = props;

    return <div data-testid="mock-react-flow">{props.children}</div>;
  },
  useReactFlow: () => ({
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
}));

const makeNode = (id: string): CanvasNode => ({
  data: {
    filePath: `${id}.ts`,
    label: id,
    nodeType: "file",
  },
  id,
  position: { x: 0, y: 0 },
  type: "file",
});

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("CanvasFlow", () => {
  it("creates a node from a dropped component payload", () => {
    const store = createCanvasStore();
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    const dataTransfer = {
      dropEffect: "move",
      getData: vi.fn(() =>
        encodeCanvasComponentDragPayload({
          kind: "object",
          type: "folder",
        }),
      ),
      types: [CANVAS_COMPONENT_DRAG_MIME],
    };
    const flow = screen.getByTestId("canvas-v2-flow");
    const dropEvent = createEvent.drop(flow, { dataTransfer });
    Object.defineProperty(dropEvent, "clientX", { value: 120 });
    Object.defineProperty(dropEvent, "clientY", { value: 240 });

    fireEvent.dragOver(flow, { dataTransfer });
    fireEvent(flow, dropEvent);

    expect(store.getState().nodes).toEqual([
      expect.objectContaining({
        position: { x: 120, y: 240 },
        type: "folder",
      }),
    ]);
    expect(store.getState().canUndo).toBe(true);
  });

  it("deletes selected items and restores them with undo", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      latestReactFlowProps?.onSelectionChange?.({ edges: [], nodes: [{ id: "node-a" }] });
    });
    expect(store.getState().selectedIds).toEqual(["node-a"]);

    act(() => {
      hotkeyHandlers.get("backspace, delete")?.();
    });
    expect(store.getState().nodes).toEqual([]);

    act(() => {
      hotkeyHandlers.get("mod+z")?.();
    });
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a"]);
  });

  it("syncs selection from React Flow", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      latestReactFlowProps?.onSelectionChange?.({
        edges: [{ id: "edge-a" }],
        nodes: [{ id: "node-a" }],
      });
    });

    expect(store.getState().selectedIds).toEqual(["node-a", "edge-a"]);
  });
});
