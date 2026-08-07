import { render, screen } from "@testing-library/react";
import type { PipelineData } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { CanvasRoot } from "./CanvasRoot";
import {
  createNotificationStore,
  NotificationStoreContext,
} from "@repo/views/store/notificationStore";

vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({}),
  useCustom: () => ({ result: { data: { traces: [] } } }),
  useList: () => ({ result: { data: [], total: 0 } }),
  useOne: () => ({ query: {} }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

vi.mock("@xyflow/react", () => ({
  BaseEdge: () => null,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Handle: ({ type, ...props }: { type: string; [key: string]: unknown }) => (
    <div data-handle-type={type} {...props} />
  ),
  Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
  ReactFlow: ({ nodes }: { nodes: { id: string }[] }) => (
    <div data-testid="mock-canvas-root-flow">{nodes.map((node) => node.id).join(",")}</div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  getBezierPath: () => ["M0,0 C0,0 0,0 0,0", 0, 0],
  useNodeId: () => "node-a",
  useNodesInitialized: () => false,
  useReactFlow: () => ({
    fitView: vi.fn(),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  useUpdateNodeInternals: () => () => undefined,
}));

const makePipeline = (overrides: Partial<PipelineData> = {}): PipelineData => ({
  createdAt: new Date("2026-06-11T00:00:00.000Z"),
  description: "",
  edges: [],
  id: "pipeline-test",
  name: "Pipeline",
  nodes: [],
  sharedContext: "",
  tags: [],
  timeoutMs: null,
  updatedAt: new Date("2026-06-11T00:00:00.000Z"),
  ...overrides,
});

describe("CanvasRoot", () => {
  it("renders the empty state for an empty pipeline", () => {
    render(
      <NotificationStoreContext.Provider value={createNotificationStore()}>
        <CanvasRoot pipeline={makePipeline()} />
      </NotificationStoreContext.Provider>,
    );

    expect(screen.getByTestId("canvas-v2-root")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-v2-empty-state")).toBeInTheDocument();
  });

  it("hydrates pipeline nodes into the V2 flow", () => {
    render(
      <NotificationStoreContext.Provider value={createNotificationStore()}>
        <CanvasRoot
          pipeline={makePipeline({
            nodes: [
              {
                data: {
                  label: "Prompt",
                  nodeType: "prompt",
                  prompt: "",
                },
                id: "node-prompt",
                position: { x: 0, y: 0 },
                type: "prompt",
              },
            ],
          })}
        />
      </NotificationStoreContext.Provider>,
    );

    expect(screen.getByTestId("mock-canvas-root-flow")).toHaveTextContent("node-prompt");
    expect(screen.queryByTestId("canvas-v2-empty-state")).not.toBeInTheDocument();
  });
});
