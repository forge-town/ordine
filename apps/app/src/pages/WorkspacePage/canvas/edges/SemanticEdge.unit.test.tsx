import { render, screen } from "@testing-library/react";
import type * as ReactFlowModule from "@xyflow/react";
import { Position } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import { SemanticEdge } from "./SemanticEdge";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactFlowModule>();

  return {
    ...actual,
    BaseEdge: ({ className }: { className?: string }) => (
      <path className={className} data-testid="semantic-edge-path" />
    ),
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

const renderEdge = (store: CanvasStore, data?: { label: string }) =>
  render(
    <svg>
      <SemanticEdge
        data={data}
        id="edge-1"
        source="node-a"
        sourcePosition={Position.Right}
        sourceX={0}
        sourceY={0}
        target="node-b"
        targetPosition={Position.Left}
        targetX={200}
        targetY={0}
      />
    </svg>,
    { wrapper: makeWrapper(store) },
  );

describe("SemanticEdge", () => {
  it("renders the edge semantic label", () => {
    const store = createCanvasStore();
    renderEdge(store, { label: "approved_payload" });

    expect(screen.getByTestId("canvas-v2-semantic-edge-label")).toHaveTextContent(
      "approved_payload",
    );
  });

  it("uses the translated default label when no label is configured", () => {
    const store = createCanvasStore();
    renderEdge(store);

    expect(screen.getByTestId("canvas-v2-semantic-edge-label")).toHaveTextContent(/^(data|数据)$/);
  });
});
