import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type * as XyFlowReact from "@xyflow/react";
import type { PipelineNode } from "../_store/canvasSlice";
import {
  createHarnessCanvasStore,
  HarnessCanvasStoreContext,
  HarnessCanvasStoreProvider,
} from "../_store";
import { CanvasFlow } from "./CanvasFlow";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XyFlowReact>();

  return {
    ...actual,
    ReactFlow: ({
      children,
      defaultViewport,
      fitView,
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
      snapToGrid,
    }: React.PropsWithChildren<{
      defaultViewport?: { zoom: number };
      fitView?: boolean;
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
      snapToGrid?: boolean;
    }>) => {
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

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

const renderWithStore = (nodes: PipelineNode[], isConsoleOpen = false) => {
  const store = createHarnessCanvasStore(nodes, []);
  store.setState({ isConsoleOpen });

  render(
    <HarnessCanvasStoreContext.Provider value={store}>
      <ReactFlowProvider>
        <CanvasFlow />
      </ReactFlowProvider>
    </HarnessCanvasStoreContext.Provider>
  );
};

describe("CanvasFlow", () => {
  it("renders without crashing", () => {
    const { container } = render(<CanvasFlow />, { wrapper });
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-zoom", "1.25");
    expect(screen.queryByTestId("flow-controls")).not.toBeInTheDocument();
  });

  it("uses custom toolbar state instead of React Flow built-in interactivity controls", () => {
    const store = createHarnessCanvasStore([], []);
    store.setState({ isCanvasInteractive: false });

    render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </HarnessCanvasStoreContext.Provider>
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

  it("hides MiniMap for a single node", () => {
    renderWithStore([makeNode("a")]);

    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
  });

  it("applies canvas view settings to React Flow", () => {
    const store = createHarnessCanvasStore([makeNode("a"), makeNode("b")], []);
    store.setState({
      canvasSettings: {
        showMiniMap: false,
        showControls: false,
        showBackground: false,
        snapToGrid: true,
      },
    });

    render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </HarnessCanvasStoreContext.Provider>
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
    const store = createHarnessCanvasStore([], []);

    render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </HarnessCanvasStoreContext.Provider>
    );

    screen.getByTestId("react-flow").dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));

    expect(store.getState().viewportZoom).toBe(0.6);
  });

  it("exposes the React Flow viewport element through the provided ref", () => {
    const store = createHarnessCanvasStore([], []);
    const viewportRef = { current: null as HTMLDivElement | null };

    render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow viewportRef={viewportRef} />
        </ReactFlowProvider>
      </HarnessCanvasStoreContext.Provider>
    );

    expect(viewportRef.current).toBe(screen.getByTestId("canvas-flow-viewport"));
  });
});
