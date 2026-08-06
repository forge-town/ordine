import { fireEvent, render, screen } from "@testing-library/react";
import type * as RefineCore from "@refinedev/core";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type * as XyFlowReact from "@xyflow/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CanvasPageStoreProvider } from "../_store";
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
  useUpdate: () => ({ mutate: vi.fn(), mutation: { isPending: false } }),
  useCreate: () => ({ mutate: vi.fn(), mutation: { isPending: false } }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../AgentPanel", () => ({
  AgentPanel: () => <aside data-testid="canvas-agent-panel" />,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

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

const makeWrapper =
  (nodes: PipelineNode[] = []) =>
  ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <CanvasPageStoreProvider pipeline={{ id: "pipe-1", name: "Pipeline", nodes, edges: [] }}>
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </CanvasPageStoreProvider>
    </QueryClientProvider>
  );

const wrapper = makeWrapper();

const wrapperWithNode = makeWrapper([existingNode]);

const wrapperWithoutPipeline = ({ children }: React.PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <CanvasPageStoreProvider pipeline={null}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </CanvasPageStoreProvider>
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

  it("renders the workspace panel at the default width with a resize handle", () => {
    render(<CanvasInner />, { wrapper });

    expect(screen.getByTestId("canvas-work-panel")).toHaveStyle({ width: "352px" });
    expect(screen.getByTestId("canvas-work-panel-resizer")).toBeInTheDocument();
  });

  it("clamps the workspace panel width while dragging the resize handle", () => {
    render(<CanvasInner />, { wrapper });

    const workPanel = screen.getByTestId("canvas-work-panel");
    const resizeHandle = screen.getByTestId("canvas-work-panel-resizer");
    const globalWindow = globalThis.window;
    vi.spyOn(workPanel, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 352,
      height: 640,
      top: 0,
      right: 352,
      bottom: 640,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(resizeHandle, { clientX: 352 });
    fireEvent.mouseMove(globalWindow, { clientX: 120 });
    expect(workPanel).toHaveStyle({ width: "288px" });

    fireEvent.mouseMove(globalWindow, { clientX: 460 });
    expect(workPanel).toHaveStyle({ width: "460px" });

    fireEvent.mouseMove(globalWindow, { clientX: 700 });
    expect(workPanel).toHaveStyle({ width: "560px" });

    fireEvent.mouseUp(globalWindow);
  });

  it("opens the AgentPanel as a resizable right-hand sibling", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });

    expect(screen.getByTestId("canvas-agent-panel-reopen")).toBeInTheDocument();

    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    expect(screen.getByTestId("canvas-agent-panel-shell")).toHaveStyle({ width: "360px" });
    expect(screen.getByTestId("resize-handle-right")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-agent-panel")).toBeInTheDocument();
  });

  it("resizes and collapses the AgentPanel from the right-side handle", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });
    await user.click(screen.getByTestId("canvas-agent-panel-reopen"));

    const globalWindow = globalThis.window;
    const resizeHandle = screen.getByTestId("resize-handle-right");

    fireEvent.pointerDown(resizeHandle, { clientX: 900 });
    fireEvent.pointerMove(globalWindow, { clientX: 820 });
    expect(screen.getByTestId("canvas-agent-panel-shell")).toHaveStyle({ width: "440px" });

    fireEvent.pointerMove(globalWindow, { clientX: 1100 });
    expect(screen.queryByTestId("canvas-agent-panel-shell")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-agent-panel-reopen")).toBeInTheDocument();
  });

  it("toggles the AgentPanel from the canvas toolbar", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });

    await user.click(screen.getByRole("button", { name: /^(AI Assistant|AI 助手)$/i }));

    expect(screen.getByTestId("canvas-agent-panel-shell")).toBeInTheDocument();

    await user.dblClick(screen.getByTestId("resize-handle-right"));

    expect(screen.getByTestId("canvas-agent-panel-reopen")).toBeInTheDocument();
  });

  it("opens the workspace sidebar overlay from the mini sidebar", async () => {
    const user = userEvent.setup();
    render(<CanvasInner />, { wrapper });

    await user.click(screen.getByRole("button", { name: /Workspace/i }));

    expect(screen.getByTestId("canvas-workspace-sidebar-overlay")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows the canvas empty state when there are no nodes", () => {
    render(<CanvasInner />, { wrapper });

    expect(screen.getByText(/Start with a node|从一个节点开始/)).toBeInTheDocument();
  });

  it("hides the canvas empty state after nodes exist", () => {
    render(<CanvasInner />, { wrapper: wrapperWithNode });

    expect(screen.queryByText(/Start with a node|从一个节点开始/)).not.toBeInTheDocument();
  });
});
