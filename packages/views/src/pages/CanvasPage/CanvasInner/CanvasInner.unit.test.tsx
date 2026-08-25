import { fireEvent, render, screen } from "@testing-library/react";
import type * as RefineCore from "@refinedev/core";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type * as XyFlowReact from "@xyflow/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createNotificationStore,
  NotificationStoreContext,
} from "../../../store/notificationStore";
import { CanvasPageStoreProvider, useCanvasPageStore } from "../_store";
import type { PipelineNode } from "../_store/canvasSlice";
import { CanvasInner } from "./CanvasInner";
import "../../../test/use-test-language";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XyFlowReact>();

  return {
    ...actual,
    ReactFlow: ({ children }: React.PropsWithChildren) => (
      <div data-testid="react-flow">{children}</div>
    ),
  };
});

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useDataProvider: () => () => ({
    getList: vi.fn(async () => ({ data: [], total: 0 })),
    getOne: vi.fn(async ({ id }: { id: string }) => ({ data: { id } })),
    create: vi.fn(async ({ variables }: { variables: object }) => ({ data: variables })),
    update: vi.fn(async ({ id, variables }: { id: string; variables: object }) => ({
      data: { id, ...variables },
    })),
    custom: vi.fn(async () => ({ data: {} })),
  }),
  useList: ({ resource }: { resource: string }) => ({
    result: {
      data:
        resource === "operations"
          ? [
              {
                id: "review-code",
                name: "Review Code",
                description: "",
                config: {},
                acceptedObjectTypes: ["file"],
              },
            ]
          : [],
    },
  }),
  useCustom: () => ({ result: { data: [] }, query: { isLoading: false } }),
  useOne: () => ({ result: undefined, query: { isLoading: false } }),
  useUpdate: () => ({ mutate: vi.fn(), mutation: { isPending: false } }),
  useCreate: () => ({ mutate: vi.fn(), mutation: { isPending: false } }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../AgentControlBridge", () => ({
  CanvasAgentControlPanel: () => <aside data-testid="canvas-agent-panel" />,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const notificationStore = createNotificationStore();

const existingNode = {
  id: "node-1",
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "",
  },
} as PipelineNode;

const ClosedAgentPanelSetup = ({ children }: React.PropsWithChildren) => {
  const store = useCanvasPageStore();
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    store.setState((state) => ({
      agentPanel: { ...state.agentPanel, isOpen: false },
      isSidebarOpen: true,
    }));
  }

  return children;
};

const SelectedNodeSetup = ({ children }: React.PropsWithChildren) => {
  const store = useCanvasPageStore();
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    store.setState({ selectedNodeId: existingNode.id, sidebarPanel: "properties" });
  }

  return children;
};

const makeWrapper =
  (nodes: PipelineNode[] = []) =>
  ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <NotificationStoreContext.Provider value={notificationStore}>
        <CanvasPageStoreProvider pipeline={{ id: "pipe-1", name: "Pipeline", nodes, edges: [] }}>
          <ClosedAgentPanelSetup>
            <ReactFlowProvider>{children}</ReactFlowProvider>
          </ClosedAgentPanelSetup>
        </CanvasPageStoreProvider>
      </NotificationStoreContext.Provider>
    </QueryClientProvider>
  );

const wrapper = makeWrapper();

const wrapperWithNode = makeWrapper([existingNode]);

const wrapperWithSelectedNode = ({ children }: React.PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <NotificationStoreContext.Provider value={notificationStore}>
      <CanvasPageStoreProvider
        pipeline={{ id: "pipe-1", name: "Pipeline", nodes: [existingNode], edges: [] }}
      >
        <ClosedAgentPanelSetup>
          <SelectedNodeSetup>
            <ReactFlowProvider>{children}</ReactFlowProvider>
          </SelectedNodeSetup>
        </ClosedAgentPanelSetup>
      </CanvasPageStoreProvider>
    </NotificationStoreContext.Provider>
  </QueryClientProvider>
);

const wrapperWithoutPipeline = ({ children }: React.PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <NotificationStoreContext.Provider value={notificationStore}>
      <CanvasPageStoreProvider pipeline={null}>
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </CanvasPageStoreProvider>
    </NotificationStoreContext.Provider>
  </QueryClientProvider>
);

describe("CanvasInner", () => {
  it("renders without crashing", () => {
    const { container } = render(<CanvasInner />, { wrapper: wrapperWithoutPipeline });
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the LangFlow shell with mini sidebar and component panel", () => {
    render(<CanvasInner />, { wrapper });

    expect(screen.getByTestId("canvas-langflow-shell")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-mini-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-component-panel")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-flow-viewport")).toBeInTheDocument();
  });

  it("supports the Alan workspace shell without replacing develop panel state", () => {
    render(<CanvasInner showCanvasMiniSidebar={false} />, { wrapper: wrapperWithoutPipeline });

    expect(screen.queryByTestId("canvas-mini-sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-component-panel")).toBeInTheDocument();
    const canvasToolbar = screen.getByTestId("canvas-v2-toolbar");
    expect(canvasToolbar).toHaveClass("absolute", "bottom-4", "right-4", "z-20");
    expect(canvasToolbar.parentElement?.tagName).toBe("MAIN");
    expect(
      screen.getByRole("button", { name: /Collapse operations panel|收起操作面板/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("canvas-v2-state-legend-trigger").closest("main")).toBeNull();
    expect(screen.queryByTestId("canvas-status-bar")).not.toBeInTheDocument();
  });

  it("renders selected node properties as an Alan modal inside main", () => {
    render(<CanvasInner />, { wrapper: wrapperWithSelectedNode });

    const modal = screen.getByTestId("canvas-v2-node-config");

    expect(modal).toHaveClass("absolute", "inset-0", "z-40", "grid", "place-items-center", "p-6");
    expect(screen.getByTestId("canvas-properties-panel")).toHaveClass("w-[440px]");
    expect(modal.parentElement?.tagName).toBe("MAIN");
    expect(screen.queryByTestId("canvas-work-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-work-panel-resizer")).not.toBeInTheDocument();
  });

  it("opens the AgentPanel as a resizable right-hand sibling", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });

    expect(screen.getByTestId("canvas-agent-panel-reopen")).toBeInTheDocument();

    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    const regionWrapper = screen.getByTestId("canvas-agent-panel-region-wrapper");
    const resizeGutter = screen.getByTestId("canvas-agent-panel-resize-gutter");
    const resizeHandle = screen.getByTestId("resize-handle-right");
    const region = screen.getByTestId("canvas-agent-panel-region");
    const shell = screen.getByTestId("canvas-agent-panel-shell");

    expect(shell).toHaveStyle({ width: "344px" });
    expect(shell).toHaveClass(
      "h-full",
      "w-full",
      "overflow-hidden",
      "rounded-2xl",
      "bg-surface",
      "shadow-float",
      "ring-1",
      "ring-border-strong",
      "max-[480px]:!w-full",
    );
    expect(regionWrapper).toHaveClass(
      "max-[480px]:!w-full",
      "min-[1181px]:h-full",
      "min-[1181px]:shrink-0",
    );
    expect(resizeGutter).toHaveClass("w-px", "min-[1181px]:h-full", "min-[1181px]:w-1.5");
    expect(region).toHaveClass(
      "max-[480px]:flex-1",
      "min-[1181px]:h-full",
      "min-[1181px]:shrink-0",
      "min-[1181px]:py-1.5",
      "min-[1181px]:pr-1.5",
    );
    expect(region).not.toHaveClass("bg-surface", "border", "shadow-float", "rounded-2xl");
    expect(shell.parentElement).toBe(region);
    expect(resizeGutter.nextElementSibling).toBe(region);
    expect(resizeHandle.parentElement).toBe(resizeGutter);
    expect(resizeHandle.querySelector(".bg-border")).toBeNull();
    expect(screen.getByTestId("canvas-agent-panel")).toBeInTheDocument();
  });

  it("keeps the component library floating when the AgentPanel opens", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });
    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    expect(screen.getByTestId("canvas-agent-panel-region-wrapper")).toHaveClass(
      "absolute",
      "top-16",
      "min-[1181px]:static",
    );
    expect(screen.getByTestId("canvas-component-panel-root")).toHaveClass(
      "absolute",
      "left-3",
      "top-16",
      "z-10",
      "max-[1180px]:hidden",
    );
  });

  it("resizes and collapses the AgentPanel from the right-side handle", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });
    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    const globalWindow = globalThis.window;
    const resizeHandle = screen.getByTestId("resize-handle-right");

    fireEvent.pointerDown(resizeHandle, { clientX: 900 });
    fireEvent.pointerMove(globalWindow, { clientX: 820 });
    expect(screen.getByTestId("canvas-agent-panel-shell")).toHaveStyle({ width: "424px" });

    fireEvent.pointerMove(globalWindow, { clientX: 1100 });
    expect(screen.queryByTestId("canvas-agent-panel-shell")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-agent-panel-reopen")).toBeInTheDocument();
  });

  it("starts AgentPanel resizing from its rendered width", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });
    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    const shell = screen.getByTestId("canvas-agent-panel-shell");
    vi.spyOn(shell, "getBoundingClientRect").mockReturnValue({
      x: 57,
      y: 0,
      width: 318,
      height: 640,
      top: 0,
      right: 375,
      bottom: 640,
      left: 57,
      toJSON: () => ({}),
    });

    const resizeHandle = screen.getByTestId("resize-handle-right");
    fireEvent.pointerDown(resizeHandle, { clientX: 57 });
    fireEvent.pointerMove(globalThis.window, { clientX: 37 });

    expect(shell).toHaveStyle({ width: "338px" });
  });

  it("supports keyboard resizing and exposes separator values", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });
    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    const resizeHandle = screen.getByTestId("resize-handle-right");
    expect(resizeHandle).toHaveAttribute("tabindex", "0");
    expect(resizeHandle).toHaveAttribute("aria-valuemin", "300");
    expect(resizeHandle).toHaveAttribute("aria-valuemax", "520");
    expect(resizeHandle).toHaveAttribute("aria-valuenow", "344");

    fireEvent.keyDown(resizeHandle, { key: "ArrowLeft" });
    expect(screen.getByTestId("canvas-agent-panel-shell")).toHaveStyle({ width: "352px" });

    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });
    expect(screen.getByTestId("canvas-agent-panel-shell")).toHaveStyle({ width: "344px" });
  });

  it("cleans up AgentPanel dragging after pointer cancellation", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });
    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    const resizeHandle = screen.getByTestId("resize-handle-right");
    fireEvent.pointerDown(resizeHandle, { clientX: 900 });
    expect(document.body.style.cursor).toBe("col-resize");

    fireEvent.pointerCancel(globalThis.window);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");

    fireEvent.pointerMove(globalThis.window, { clientX: 820 });
    expect(screen.getByTestId("canvas-agent-panel-shell")).toHaveStyle({ width: "344px" });
  });

  it("does not duplicate the Agent action in the canvas toolbar", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });

    await user.click(screen.getByTestId("canvas-actions-menu"));
    expect(
      screen.queryByRole("menuitem", { name: /^(AI Assistant|AI 助手)$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-agent-panel-reopen")).toBeInTheDocument();
  });

  it("opens the workspace sidebar overlay from the mini sidebar", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });

    await user.click(screen.getByRole("button", { name: /Workspace/i }));

    expect(screen.getByTestId("canvas-workspace-sidebar-overlay")).toBeInTheDocument();
    expect(screen.getByText("Pipelines")).toBeInTheDocument();
    expect(screen.getByText("Assembly")).toBeInTheDocument();
  });

  it("shows the canvas empty state when there are no nodes", () => {
    render(<CanvasInner />, { wrapper });

    expect(
      screen.getByRole("heading", { name: /Start with a node|从一个节点开始/ }),
    ).toBeInTheDocument();
  });

  it("hides the canvas empty state after nodes exist", () => {
    render(<CanvasInner />, { wrapper: wrapperWithNode });

    expect(screen.queryByText(/Start with a node|从一个节点开始/)).not.toBeInTheDocument();
  });
});
