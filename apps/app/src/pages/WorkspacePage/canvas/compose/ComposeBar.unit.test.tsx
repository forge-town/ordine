import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { ComposeBar } from "./ComposeBar";

const mutateMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({ mutate: mutateMock }),
}));

const makeNode = (id: string): CanvasNode => ({
  data: {
    config: {},
    label: id,
    nodeType: "operation",
    operationId: id,
    operationName: id,
    status: "idle",
  },
  id,
  position: { x: 0, y: 0 },
  type: "operation",
});

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("ComposeBar", () => {
  beforeEach(() => {
    mutateMock.mockReset();
  });

  it("stays hidden until two nodes are selected", () => {
    const store = createCanvasStore({ nodes: [makeNode("node-a"), makeNode("node-b")] });
    store.getState().setSelectedIds(["node-a"]);
    render(<ComposeBar pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-compose-bar")).not.toBeInTheDocument();
  });

  it("composes the selection into a compound and persists", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [makeNode("node-a"), makeNode("node-b")] });
    store.getState().setSelectedIds(["node-a", "node-b"]);
    render(<ComposeBar pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-compose-action"));

    const compound = store.getState().nodes.find((node) => node.type === "compound");
    expect(compound).toBeDefined();
    expect(store.getState().selectedIds).toEqual([compound?.id]);
    expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({ id: "pipeline-1" }));
  });

  it("clears the selection from the bar", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [makeNode("node-a"), makeNode("node-b")] });
    store.getState().setSelectedIds(["node-a", "node-b"]);
    render(<ComposeBar pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-compose-clear"));

    expect(store.getState().selectedIds).toEqual([]);
  });
});
