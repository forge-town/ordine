import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CompoundNodeData } from "@repo/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../../_store/canvasStore";
import type { CanvasEdge, CanvasNode } from "../../_store/canvasTypes";
import { EdgeInspector } from "./EdgeInspector";

const mutateMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({ mutateAsync: mutateMock }),
}));

const nodes: CanvasNode[] = [
  {
    data: { label: "Source", nodeType: "prompt", prompt: "" },
    id: "node-a",
    position: { x: 0, y: 0 },
    type: "prompt",
  },
  {
    data: {
      config: {},
      label: "Parse",
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

const edge: CanvasEdge = {
  data: {
    dataContract: {
      mappings: [
        { enabled: true, fromField: "vocabulary", toInput: "source_terms", type: "Term[]" },
        { enabled: false, fromField: "text_blocks", toInput: "blocks", type: "Block[]" },
      ],
    },
    label: "vocabulary",
  },
  id: "edge-1",
  source: "node-a",
  target: "node-b",
};

const compoundNode: CanvasNode = {
  data: {
    boundaryEdges: [],
    childEdges: [edge],
    childNodeIds: ["node-a", "node-b"],
    compoundKind: "custom",
    label: "Compound",
    nodeType: "compound",
  },
  id: "compound-1",
  position: { x: 0, y: 0 },
  type: "compound",
};

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("EdgeInspector", () => {
  beforeEach(() => {
    mutateMock.mockReset().mockResolvedValue({});
  });

  it("renders nothing without an inspected edge", () => {
    const store = createCanvasStore({ edges: [edge], nodes });
    render(<EdgeInspector pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-edge-inspector")).not.toBeInTheDocument();
  });

  it("toggles a mapping and persists the edges", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ edges: [edge], nodes });
    store.getState().openEdgeInspector("edge-1");
    render(<EdgeInspector pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("edge-inspector-mapping-0"));

    const mappings = store.getState().edges[0]?.data?.dataContract?.mappings;
    expect(mappings?.[0]?.enabled).toBe(false);
    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pipeline-1",
          values: expect.objectContaining({ edges: expect.anything(), nodes: expect.anything() }),
        }),
      ),
    );
  });

  it("deletes the edge and closes", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ edges: [edge], nodes });
    store.getState().openEdgeInspector("edge-1");
    render(<EdgeInspector pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("edge-inspector-delete"));

    expect(store.getState().edges).toHaveLength(0);
    expect(store.getState().inspectEdgeId).toBeNull();
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
  });

  it("inspects and persists an edge inside the active compound", async () => {
    const user = userEvent.setup();
    const childNodes = nodes.map((node) => ({
      ...node,
      extent: "parent" as const,
      parentId: "compound-1",
    }));
    const store = createCanvasStore({ nodes: [compoundNode, ...childNodes] });
    store.setState({ drillStack: ["compound-1"] });
    store.getState().openEdgeInspector("edge-1");
    render(<EdgeInspector pipelineId="pipeline-compound" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("edge-inspector-mapping-0"));

    expect(screen.getByTestId("canvas-v2-edge-inspector")).toBeInTheDocument();
    expect(
      (store.getState().nodes[0]!.data as CompoundNodeData).childEdges?.[0]?.data?.dataContract
        ?.mappings[0]?.enabled,
    ).toBe(false);
    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ nodes: expect.anything() }),
        }),
      ),
    );
  });
});
