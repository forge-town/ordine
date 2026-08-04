import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import type * as ReactFlowModule from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  encodeCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { CanvasFlow } from "./CanvasFlow";

type ReactFlowProps = {
  onNodeDoubleClick?: (event: unknown, node: CanvasNode) => void;
  onNodesChange?: (changes: unknown[]) => void;
  onPaneClick?: () => void;
  onSelectionChange?: (selection: { edges: { id: string }[]; nodes: { id: string }[] }) => void;
};

const hotkeyHandlers = new Map<string, () => void>();
const latestReactFlowPropsRef = { current: null as ReactFlowProps | null };

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: (keys: string, handler: () => void) => {
    hotkeyHandlers.set(keys, handler);
  },
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactFlowModule>();

  return {
    ...actual,
    ReactFlow: (props: ReactFlowProps & { children?: React.ReactNode }) => {
      latestReactFlowPropsRef.current = props;

      return <div data-testid="mock-react-flow">{props.children}</div>;
    },
    useReactFlow: () => ({
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    }),
  };
});

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
      latestReactFlowPropsRef.current?.onSelectionChange?.({
        edges: [],
        nodes: [{ id: "node-a" }],
      });
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

  it("records one undo entry for a complete node drag", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      latestReactFlowPropsRef.current?.onNodesChange?.([
        {
          dragging: true,
          id: "node-a",
          position: { x: 40, y: 20 },
          type: "position",
        },
      ]);
      latestReactFlowPropsRef.current?.onNodesChange?.([
        {
          dragging: true,
          id: "node-a",
          position: { x: 80, y: 40 },
          type: "position",
        },
      ]);
    });

    expect(store.getState().historyPast).toHaveLength(0);

    act(() => {
      latestReactFlowPropsRef.current?.onNodesChange?.([
        {
          dragging: false,
          id: "node-a",
          position: { x: 120, y: 60 },
          type: "position",
        },
      ]);
    });

    expect(store.getState().historyPast).toHaveLength(1);
    expect(store.getState().nodes[0]?.position).toEqual({ x: 120, y: 60 });

    act(() => store.getState().undo());

    expect(store.getState().nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it("does not drill into a compound while previewing a proposal", () => {
    const compound: CanvasNode = {
      data: {
        childNodeIds: [],
        label: "Verify group",
        nodeType: "compound",
      },
      id: "compound-a",
      position: { x: 0, y: 0 },
      type: "compound",
    };
    const store = createCanvasStore({ nodes: [compound] });
    store.getState().setPendingProposal({ actions: [], summary: "Preview" });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      latestReactFlowPropsRef.current?.onNodeDoubleClick?.({}, compound);
    });

    expect(store.getState().drillStack).toEqual([]);
    expect(store.getState().proposalPreview).not.toBeNull();
  });

  it("syncs selection from React Flow", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      latestReactFlowPropsRef.current?.onSelectionChange?.({
        edges: [{ id: "edge-a" }],
        nodes: [{ id: "node-a" }],
      });
    });

    expect(store.getState().selectedIds).toEqual(["node-a", "edge-a"]);
  });
});
