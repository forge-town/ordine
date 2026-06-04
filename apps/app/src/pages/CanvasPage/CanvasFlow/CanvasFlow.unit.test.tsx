import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type * as XyFlowReact from "@xyflow/react";
import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";
import { createCanvasPageStore, CanvasPageStoreContext, CanvasPageStoreProvider } from "../_store";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  encodeCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { CanvasFlow } from "./CanvasFlow";

const xyflowMocks = vi.hoisted(() => {
  const updateNodeInternals = vi.fn();

  return {
    onNodesChange: undefined as ((changes: unknown[]) => void) | undefined,
    renderedEdges: [] as Array<{
      id: string;
      animated?: boolean;
      style?: { opacity?: number; stroke?: string; strokeWidth?: number };
      type?: string;
    }>,
    updateNodeInternals,
    useUpdateNodeInternals: vi.fn(() => updateNodeInternals),
  };
});

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XyFlowReact>();

  return {
    ...actual,
    ReactFlow: ({
      children,
      defaultViewport,
      fitView,
      minZoom,
      onMove,
      elementsSelectable,
      nodesConnectable,
      nodesDraggable,
      panOnDrag,
      zoomOnDoubleClick,
      zoomOnPinch,
      zoomOnScroll,
      deleteKeyCode,
      onConnect,
      onConnectEnd,
      onConnectStart,
      onEdgeClick,
      onNodeClick,
      onNodeContextMenu,
      onNodeDrag,
      onNodeDragStop,
      onPaneClick,
      onPaneContextMenu,
      onNodesChange,
      snapToGrid,
      edges,
    }: React.PropsWithChildren<{
      defaultViewport?: { zoom: number };
      fitView?: boolean;
      minZoom?: number;
      onMove?: XyFlowReact.OnMove;
      elementsSelectable?: boolean;
      nodesConnectable?: boolean;
      nodesDraggable?: boolean;
      panOnDrag?: boolean;
      zoomOnDoubleClick?: boolean;
      zoomOnPinch?: boolean;
      zoomOnScroll?: boolean;
      deleteKeyCode?: string[] | null;
      onConnect?: unknown;
      onConnectEnd?: unknown;
      onConnectStart?: unknown;
      onEdgeClick?: unknown;
      onNodeClick?: unknown;
      onNodeContextMenu?: unknown;
      onNodeDrag?: unknown;
      onNodeDragStop?: unknown;
      onPaneClick?: unknown;
      onPaneContextMenu?: unknown;
      onNodesChange?: unknown;
      snapToGrid?: boolean;
      edges?: Array<{
        id: string;
        animated?: boolean;
        style?: { opacity?: number; stroke?: string; strokeWidth?: number };
        type?: string;
      }>;
    }>) => {
      xyflowMocks.onNodesChange = onNodesChange as ((changes: unknown[]) => void) | undefined;
      xyflowMocks.renderedEdges = edges ?? [];
      const handleMouseMove = () => onMove?.(null, { x: 0, y: 0, zoom: 0.6 });

      return (
        <div
          data-auto-fit={String(fitView ?? false)}
          data-delete-key-code={JSON.stringify(deleteKeyCode)}
          data-elements-selectable={String(elementsSelectable ?? true)}
          data-has-on-connect={String(typeof onConnect === "function")}
          data-has-on-connect-end={String(typeof onConnectEnd === "function")}
          data-has-on-connect-start={String(typeof onConnectStart === "function")}
          data-has-on-edge-click={String(typeof onEdgeClick === "function")}
          data-has-on-node-click={String(typeof onNodeClick === "function")}
          data-has-on-node-context-menu={String(typeof onNodeContextMenu === "function")}
          data-has-on-node-drag={String(typeof onNodeDrag === "function")}
          data-has-on-node-drag-stop={String(typeof onNodeDragStop === "function")}
          data-has-on-pane-click={String(typeof onPaneClick === "function")}
          data-has-on-pane-context-menu={String(typeof onPaneContextMenu === "function")}
          data-min-zoom={String(minZoom)}
          data-nodes-connectable={String(nodesConnectable ?? true)}
          data-nodes-draggable={String(nodesDraggable ?? true)}
          data-pan-on-drag={String(panOnDrag ?? true)}
          data-snap-to-grid={String(snapToGrid ?? false)}
          data-testid="react-flow"
          data-zoom={defaultViewport?.zoom}
          data-zoom-on-double-click={String(zoomOnDoubleClick ?? true)}
          data-zoom-on-pinch={String(zoomOnPinch ?? true)}
          data-zoom-on-scroll={String(zoomOnScroll ?? true)}
          onMouseMove={handleMouseMove}
        >
          {children}
        </div>
      );
    },
    Background: () => <div data-testid="flow-background" />,
    Controls: () => <div data-testid="flow-controls" />,
    MiniMap: () => <div data-testid="mini-map" />,
    useUpdateNodeInternals: xyflowMocks.useUpdateNodeInternals,
  };
});

const makeNode = (id: string): PipelineNode =>
  ({
    id,
    type: "file",
    position: { x: 0, y: 0 },
    data: {
      label: id,
      nodeType: "file",
      filePath: "",
      language: "typescript",
      description: "",
    },
  }) as PipelineNode;

const makeEdge = (source: string, target: string): PipelineEdge =>
  ({
    id: `${source}-${target}`,
    source,
    target,
    type: "default",
  }) as PipelineEdge;

const wrapper = ({ children }: React.PropsWithChildren) => (
  <CanvasPageStoreProvider pipeline={null}>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </CanvasPageStoreProvider>
);

const renderWithStore = (
  nodes: PipelineNode[],
  isConsoleOpen = false,
  edges: PipelineEdge[] = [],
) => {
  const store = createCanvasPageStore(nodes, edges);
  store.setState({ isConsoleOpen });

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <ReactFlowProvider>
        <CanvasFlow />
      </ReactFlowProvider>
    </CanvasPageStoreContext.Provider>,
  );
};

const makeDragEvent = (
  type: "dragover" | "drop",
  dataTransfer: object,
  position?: { clientX: number; clientY: number },
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  Object.defineProperty(event, "clientX", { value: position?.clientX ?? 0 });
  Object.defineProperty(event, "clientY", { value: position?.clientY ?? 0 });

  return event;
};

describe("CanvasFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    xyflowMocks.onNodesChange = undefined;
    xyflowMocks.renderedEdges = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders without crashing", () => {
    const { container } = render(<CanvasFlow />, { wrapper });
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-zoom", "1.25");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-min-zoom", "0.35");
    expect(screen.queryByTestId("flow-controls")).not.toBeInTheDocument();
  });

  it("uses custom toolbar state instead of React Flow built-in interactivity controls", () => {
    const store = createCanvasPageStore([], []);
    store.setState({ isCanvasInteractive: false });

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-nodes-draggable", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-nodes-connectable", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-elements-selectable", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-pan-on-drag", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-zoom-on-scroll", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-has-on-node-click", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-has-on-edge-click", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-has-on-pane-click", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-has-on-connect", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-delete-key-code", "null");
  });

  it("shows MiniMap when multiple nodes exist and the console is closed", () => {
    renderWithStore([makeNode("a"), makeNode("b")]);

    expect(screen.getByTestId("mini-map")).toBeInTheDocument();
    expect(screen.getByTestId("flow-background")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-controls")).not.toBeInTheDocument();
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-auto-fit", "false");
  });

  it("renders stored default edges with quiet readable styling", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const edges = [makeEdge("a", "b")];

    renderWithStore(nodes, false, edges);

    expect(xyflowMocks.renderedEdges).toEqual([
      expect.objectContaining({
        animated: false,
        id: "a-b",
        style: expect.objectContaining({
          opacity: 0.5,
          stroke: "#94a3b8",
          strokeWidth: 1.25,
        }),
        type: "default",
      }),
    ]);
    expect(edges[0]?.type).toBe("default");
  });

  it("highlights edges attached to the selected node and fades unrelated edges", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const store = createCanvasPageStore(nodes, edges);
    store.setState({ selectedNodeId: "a" });

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    expect(xyflowMocks.renderedEdges).toEqual([
      expect.objectContaining({
        id: "a-b",
        style: expect.objectContaining({ opacity: 0.95, stroke: "#7c3aed" }),
      }),
      expect.objectContaining({
        id: "b-c",
        style: expect.objectContaining({ opacity: 0.16 }),
      }),
    ]);
  });

  it("hides MiniMap for a single node", () => {
    renderWithStore([makeNode("a")]);

    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
  });

  it("applies canvas view settings to React Flow", () => {
    const store = createCanvasPageStore([makeNode("a"), makeNode("b")], []);
    store.setState({
      canvasSettings: {
        showMiniMap: false,
        showControls: false,
        showBackground: false,
        snapToGrid: true,
      },
    });

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flow-background")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flow-controls")).not.toBeInTheDocument();
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-snap-to-grid", "true");
  });

  it("hides MiniMap while the console is open", () => {
    renderWithStore([makeNode("a"), makeNode("b")], true);

    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
  });

  it("records viewport zoom changes", () => {
    const store = createCanvasPageStore([], []);

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    screen.getByTestId("react-flow").dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));

    expect(store.getState().viewportZoom).toBe(0.6);
  });

  it("exposes the React Flow viewport element through the provided ref", () => {
    const store = createCanvasPageStore([], []);
    const viewportRef = { current: null as HTMLDivElement | null };

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow viewportRef={viewportRef} />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    expect(viewportRef.current).toBe(screen.getByTestId("canvas-flow-viewport"));
  });

  it("drops dragged palette items onto the flow viewport", () => {
    const store = createCanvasPageStore([], []);
    const dataTransfer = {
      dropEffect: "none",
      types: [CANVAS_COMPONENT_DRAG_MIME],
      getData: vi.fn(() =>
        encodeCanvasComponentDragPayload({
          kind: "object",
          type: "file",
        }),
      ),
    };

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    const viewport = screen.getByTestId("canvas-flow-viewport");
    fireEvent(viewport, makeDragEvent("dragover", dataTransfer));
    fireEvent(viewport, makeDragEvent("drop", dataTransfer, { clientX: 240, clientY: 180 }));

    expect(dataTransfer.dropEffect).toBe("copy");
    expect(store.getState().nodes).toEqual([
      expect.objectContaining({
        type: "file",
        origin: [0.5, 0.5],
        position: { x: 240, y: 180 },
      }),
    ]);
  });

  it("coalesces repeated node-internals remeasurements", () => {
    vi.useFakeTimers();

    const scheduledFrames = new Map<number, ReturnType<typeof setTimeout>>();
    const nextFrameId = { current: 1 };

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId.current;
        nextFrameId.current += 1;
        const timeoutId = globalThis.setTimeout(() => callback(16), 0);

        scheduledFrames.set(frameId, timeoutId);

        return frameId;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => {
        const timeoutId = scheduledFrames.get(frameId);

        if (timeoutId !== undefined) {
          globalThis.clearTimeout(timeoutId);
          scheduledFrames.delete(frameId);
        }
      }),
    );

    const store = createCanvasPageStore([makeNode("a")], []);

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    act(() => {
      xyflowMocks.onNodesChange?.([
        {
          id: "a",
          type: "position",
          position: { x: 12, y: 18 },
          dragging: false,
        },
      ]);
      xyflowMocks.onNodesChange?.([
        {
          id: "a",
          type: "position",
          position: { x: 24, y: 36 },
          dragging: false,
        },
      ]);
      vi.runAllTimers();
    });

    expect(xyflowMocks.updateNodeInternals).toHaveBeenCalledTimes(2);
    expect(xyflowMocks.updateNodeInternals).toHaveBeenNthCalledWith(1, ["a"]);
    expect(xyflowMocks.updateNodeInternals).toHaveBeenNthCalledWith(2, ["a"]);
  });

  it("falls back to timeout when requestAnimationFrame is unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);

    const store = createCanvasPageStore([makeNode("a")], []);

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </CanvasPageStoreContext.Provider>,
    );

    expect(() => {
      act(() => {
        xyflowMocks.onNodesChange?.([
          {
            id: "a",
            type: "position",
            position: { x: 12, y: 18 },
            dragging: false,
          },
        ]);
        vi.runAllTimers();
      });
    }).not.toThrow();
    expect(xyflowMocks.updateNodeInternals).toHaveBeenCalledTimes(1);
    expect(xyflowMocks.updateNodeInternals).toHaveBeenCalledWith(["a"]);
  });
});
