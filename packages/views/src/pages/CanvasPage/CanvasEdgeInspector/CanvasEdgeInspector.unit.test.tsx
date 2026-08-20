import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render } from "../../../test/test-wrapper";
import {
  CanvasPageStoreContext,
  createCanvasPageStore,
  type PipelineEdge,
  type PipelineNode,
} from "../_store";
import { CanvasEdgeInspector } from "./CanvasEdgeInspector";

const nodes: PipelineNode[] = [
  {
    data: { description: "", label: "Source", nodeType: "prompt", prompt: "" },
    id: "node-a",
    position: { x: 0, y: 0 },
    type: "prompt",
  },
  {
    data: {
      config: {},
      label: "Parse",
      maxLoopCount: 3,
      nodeType: "operation",
      operationId: "op-1",
      operationName: "Parse",
      status: "idle",
    },
    id: "node-b",
    position: { x: 200, y: 0 },
    type: "operation",
  },
];

const edge: PipelineEdge = {
  data: {
    dataContract: {
      mappings: [
        { enabled: true, fromField: "vocabulary", toInput: "source_terms", type: "Term[]" },
      ],
    },
    label: "vocabulary",
  },
  id: "edge-1",
  source: "node-a",
  target: "node-b",
};

const renderInspector = () => {
  const store = createCanvasPageStore(nodes, [edge]);
  store.setState({ selectedEdgeId: "edge-1" });
  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasEdgeInspector />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasEdgeInspector", () => {
  it("renders from develop edge selection without a second inspector state", () => {
    renderInspector();

    expect(screen.getByTestId("canvas-edge-inspector")).toHaveClass(
      "w-[420px]",
      "max-w-[calc(100vw-2rem)]",
    );
    expect(screen.getByTestId("canvas-edge-inspector")).toHaveTextContent("Source");
    expect(screen.getByTestId("canvas-edge-inspector")).toHaveTextContent("Parse");
  });

  it("updates the existing develop edge data and closes through clearSelection", async () => {
    const user = userEvent.setup();
    const store = renderInspector();

    await user.click(screen.getByTestId("canvas-edge-mapping-0"));
    expect(store.getState().edges[0]?.data?.dataContract?.mappings[0]?.enabled).toBe(false);

    await user.type(screen.getByTestId("canvas-edge-condition"), "approved");
    expect(store.getState().edges[0]?.data?.condition?.expression).toBe("approved");

    await user.click(screen.getByTestId("canvas-edge-inspector-close"));
    expect(store.getState().selectedEdgeId).toBeNull();
  });
});
