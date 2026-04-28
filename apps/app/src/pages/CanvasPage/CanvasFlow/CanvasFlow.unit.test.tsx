import { render, screen, waitFor } from "@testing-library/react";
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
    }: React.PropsWithChildren<{
      defaultViewport?: { zoom: number };
      fitView?: boolean;
      onMove?: XyFlowReact.OnMove;
    }>) => {
      const handleMouseMove = () => onMove?.(null, { x: 0, y: 0, zoom: 0.6 });

      return (
        <div
          data-auto-fit={String(fitView ?? false)}
          data-testid="react-flow"
          data-zoom={defaultViewport?.zoom}
          onMouseMove={handleMouseMove}
        >
          {children}
        </div>
      );
    },
    MiniMap: () => <div data-testid="mini-map" />,
  };
});

const makeNode = (id: string): PipelineNode =>
  ({
    id,
    type: "code-file",
    position: { x: 0, y: 0 },
    data: {
      label: id,
      nodeType: "code-file",
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
  });

  it("shows MiniMap when multiple nodes exist and the console is closed", () => {
    renderWithStore([makeNode("a"), makeNode("b")]);

    expect(screen.getByTestId("mini-map")).toBeInTheDocument();
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-auto-fit", "false");
  });

  it("hides MiniMap for a single node", () => {
    renderWithStore([makeNode("a")]);

    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
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

  it("registers the React Flow viewport center for quick-add placement", async () => {
    const store = createHarnessCanvasStore([], []);
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 240,
      y: 72,
      left: 240,
      top: 72,
      width: 960,
      height: 640,
      right: 1200,
      bottom: 712,
      toJSON: () => ({}),
    } as DOMRect);

    render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <CanvasFlow />
        </ReactFlowProvider>
      </HarnessCanvasStoreContext.Provider>
    );

    await waitFor(() => {
      expect(store.getState().getViewportScreenCenter()).toEqual({ x: 720, y: 392 });
    });

    rectSpy.mockRestore();
  });
});
