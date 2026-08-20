import { act, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { Position, ReactFlowProvider, type EdgeProps } from "@xyflow/react";
import type * as XyFlowReact from "@xyflow/react";
import type { PipelineActionProposal, PipelineEdgeData } from "@repo/schemas";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageState } from "../_store";
import { SemanticEdge } from "./SemanticEdge";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XyFlowReact>();

  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: PropsWithChildren) => <>{children}</>,
  };
});

const baseEdgeProps = {
  data: { label: "document" } satisfies PipelineEdgeData,
  id: "edge-1",
  selected: false,
  source: "source",
  sourcePosition: Position.Right,
  sourceX: 40,
  sourceY: 80,
  target: "target",
  targetPosition: Position.Left,
  targetX: 260,
  targetY: 80,
} as EdgeProps;

const proposal: PipelineActionProposal = {
  actions: [{ edgeId: "edge-1", type: "removeEdge" }],
  summary: "Remove the edge",
};

const renderSemanticEdge = (
  state: Partial<CanvasPageState> = {},
  props: Partial<EdgeProps> = {},
) => {
  const store = createCanvasPageStore([], []);
  store.setState(state);

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <ReactFlowProvider>
        <svg>
          <SemanticEdge {...baseEdgeProps} {...props} />
        </svg>
      </ReactFlowProvider>
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

const edgePath = () => document.querySelector("path");
const edgeLabel = () => screen.getByTestId("canvas-v2-semantic-edge-label");

describe("SemanticEdge", () => {
  it("renders the Alan edge path and centered data label in the idle state", () => {
    renderSemanticEdge();

    expect(edgePath()).toHaveClass("stroke-[2px]");
    expect(edgePath()).toHaveClass("stroke-muted-foreground/45");
    expect(edgeLabel()).toHaveTextContent("document");
    expect(edgeLabel()).toHaveClass("bg-surface", "ring-border");
  });

  it("uses the current selectedEdgeId and keeps selection visually dominant", () => {
    const store = renderSemanticEdge();

    act(() => {
      store.setState({ selectedEdgeId: "edge-1" });
    });

    expect(edgePath()).toHaveClass("stroke-foreground");
    expect(edgeLabel()).toHaveClass("bg-foreground", "ring-foreground");
  });

  it("derives pending, flow, and done states from current develop state", () => {
    const store = renderSemanticEdge({
      agentPanel: {
        diagnostics: null,
        isLoading: false,
        isOpen: true,
        pendingProposal: proposal,
      },
    });

    expect(edgePath()).toHaveClass("stroke-muted-foreground/40", "opacity-60");
    expect(edgeLabel()).toHaveClass("text-muted-foreground", "opacity-70");

    act(() => {
      store.setState({
        agentPanel: {
          diagnostics: null,
          isLoading: false,
          isOpen: true,
          pendingProposal: null,
        },
        nodeRunStatuses: { source: "done", target: "running" },
      });
    });

    expect(edgePath()).toHaveClass("stroke-foreground", "edge-flow");
    expect(edgeLabel()).toHaveClass("bg-foreground", "ring-foreground");

    act(() => {
      store.setState({ nodeRunStatuses: { source: "done", target: "done" } });
    });

    expect(edgePath()).toHaveClass("stroke-success");
    expect(edgeLabel()).toHaveClass("bg-success/10", "text-success", "ring-success/20");
  });

  it("uses warning dashed loop styling and preserves quality-gate labels", () => {
    renderSemanticEdge(
      {},
      {
        data: {
          condition: { expression: "retry" },
          label: "retry",
          qualityGate: { criteria: "valid", onFail: "retry" },
        } satisfies PipelineEdgeData,
      },
    );

    expect(edgePath()).toHaveClass("stroke-warning", "[stroke-dasharray:6_4]");
    expect(edgeLabel()).toHaveTextContent("retry");
  });
});
