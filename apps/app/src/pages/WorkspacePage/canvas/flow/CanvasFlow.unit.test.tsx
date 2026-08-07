import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as ReactFlowModule from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import type { Operation, Skill } from "@repo/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  encodeCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { CanvasFlow } from "./CanvasFlow";

type ReactFlowProps = {
  nodesConnectable?: boolean;
  panOnDrag?: boolean | number[];
  panOnScroll?: boolean;
  selectionOnDrag?: boolean;
  zoomOnScroll?: boolean;
  onConnect?: (connection: Connection) => void;
  onEdgesChange?: (changes: unknown[]) => void;
  onNodeClick?: (event: Pick<React.MouseEvent, "metaKey" | "shiftKey">, node: CanvasNode) => void;
  onNodeDoubleClick?: (event: unknown, node: CanvasNode) => void;
  onNodesChange?: (changes: unknown[]) => void;
  onPaneClick?: () => void;
  onSelectionChange?: (selection: { edges: { id: string }[]; nodes: { id: string }[] }) => void;
};

const hotkeyHandlers = new Map<string, () => void>();
const hotkeyOptions = new Map<string, { enableOnFormTags?: boolean }>();
const latestReactFlowPropsRef = { current: null as ReactFlowProps | null };
const refineMocks = vi.hoisted(() => ({ create: vi.fn(), getList: vi.fn() }));
const reactFlowMocks = vi.hoisted(() => ({ fitView: vi.fn(async () => true) }));

vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({
    create: refineMocks.create,
    getList: refineMocks.getList,
  }),
}));

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: (keys: string, handler: () => void, options: { enableOnFormTags?: boolean } = {}) => {
    hotkeyHandlers.set(keys, handler);
    hotkeyOptions.set(keys, options);
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
      fitView: reactFlowMocks.fitView,
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    }),
    useNodesInitialized: () => true,
  };
});

const skill = {
  category: "quality",
  description: "Reviews files",
  id: "review",
  label: "Review",
  name: "review",
  tags: [],
} satisfies Skill;

const skillOperation = {
  acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
  config: {
    executor: { agentMode: "skill", skillId: skill.id, type: "agent" },
    inputs: [],
    outputs: [],
  },
  description: skill.description,
  id: `skill-operation-${skill.id}`,
  name: skill.label,
  sourceSkillId: skill.id,
} satisfies Operation;

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

const makeDataTransfer = (payload: Parameters<typeof encodeCanvasComponentDragPayload>[0]) => ({
  dropEffect: "move",
  getData: vi.fn(() => encodeCanvasComponentDragPayload(payload)),
  types: [CANVAS_COMPONENT_DRAG_MIME],
});

describe("CanvasFlow", () => {
  beforeEach(() => {
    hotkeyHandlers.clear();
    hotkeyOptions.clear();
    latestReactFlowPropsRef.current = null;
    reactFlowMocks.fitView.mockClear();
    refineMocks.create.mockReset();
    refineMocks.getList.mockReset();
  });

  it("creates a node from a dropped component payload", () => {
    const store = createCanvasStore();
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    const dataTransfer = makeDataTransfer({ kind: "object", type: "folder" });
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

  it("defaults to hand panning and uses the wheel for zoom", () => {
    const store = createCanvasStore();
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    expect(store.getState().canvasTool).toBe("hand");
    expect(latestReactFlowPropsRef.current?.panOnDrag).toBe(true);
    expect(latestReactFlowPropsRef.current?.panOnScroll).toBe(false);
    expect(latestReactFlowPropsRef.current?.selectionOnDrag).toBe(false);
    expect(latestReactFlowPropsRef.current?.zoomOnScroll).toBe(true);
  });

  it("adds a skill node with a persisted operation id", async () => {
    refineMocks.getList.mockResolvedValue({ data: [skillOperation], total: 1 });
    const store = createCanvasStore();
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });
    const flow = screen.getByTestId("canvas-v2-flow");
    const dropEvent = createEvent.drop(flow, {
      dataTransfer: makeDataTransfer({ kind: "skill", skill }),
    });
    Object.defineProperty(dropEvent, "clientX", { value: 120 });
    Object.defineProperty(dropEvent, "clientY", { value: 240 });

    fireEvent(flow, dropEvent);

    await waitFor(() =>
      expect(store.getState().nodes[0]?.data).toMatchObject({
        operationId: skillOperation.id,
        operationName: skillOperation.name,
      }),
    );
    expect(refineMocks.create).not.toHaveBeenCalled();
    expect(store.getState().historyPast).toHaveLength(1);
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

  it("adds nodes to the selection with a modifier click", () => {
    const nodeA = makeNode("node-a");
    const nodeB = makeNode("node-b");
    const store = createCanvasStore({ nodes: [nodeA, nodeB] });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      latestReactFlowPropsRef.current?.onNodeClick?.({ metaKey: false, shiftKey: false }, nodeA);
      latestReactFlowPropsRef.current?.onNodeClick?.({ metaKey: false, shiftKey: true }, nodeB);
    });

    expect(store.getState().selectedIds).toEqual(["node-a", "node-b"]);
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

  it("disables dropping and connecting while drilled into a compound", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a"), makeNode("node-b")] });
    store.setState({ drillStack: ["compound-a"] });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });
    const flow = screen.getByTestId("canvas-v2-flow");
    const dropEvent = createEvent.drop(flow, {
      dataTransfer: makeDataTransfer({ kind: "object", type: "folder" }),
    });

    fireEvent(flow, dropEvent);
    act(() => {
      latestReactFlowPropsRef.current?.onConnect?.({
        source: "node-a",
        sourceHandle: null,
        target: "node-b",
        targetHandle: null,
      });
      latestReactFlowPropsRef.current?.onEdgesChange?.([{ id: "edge-a", type: "remove" }]);
    });

    expect(store.getState().nodes).toHaveLength(2);
    expect(store.getState().edges).toEqual([]);
    expect(latestReactFlowPropsRef.current?.nodesConnectable).toBe(false);
  });

  it("does not delete selected nodes while drilled into a compound", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });
    store.setState({ drillStack: ["compound-a"], selectedIds: ["node-a"] });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      hotkeyHandlers.get("backspace, delete")?.();
    });

    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a"]);
    expect(store.getState().historyPast).toHaveLength(0);
  });

  it("disables undo and redo while previewing a proposal", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });
    const previous = { edges: store.getState().edges, nodes: store.getState().nodes };
    store.getState().duplicateNode("node-a", "node-b");
    store.getState().recordHistory(previous);
    store.getState().setPendingProposal({ actions: [], summary: "Preview" });
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => {
      hotkeyHandlers.get("mod+z")?.();
      hotkeyHandlers.get("mod+shift+z, mod+y")?.();
    });

    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a", "node-b"]);
    expect(store.getState().proposalPreview).not.toBeNull();
  });

  it("closes an inspector with Escape while a form control is focused", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });
    store.getState().openNodeConfig("node-a");
    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    act(() => hotkeyHandlers.get("escape")?.());

    expect(store.getState().configNodeId).toBeNull();
    expect(hotkeyOptions.get("escape")?.enableOnFormTags).toBe(true);
  });

  it("fits the visible graph after node dimensions initialize", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a")] });

    render(<CanvasFlow />, { wrapper: makeWrapper(store) });

    expect(reactFlowMocks.fitView).toHaveBeenCalledWith({ padding: 0.1 });
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
