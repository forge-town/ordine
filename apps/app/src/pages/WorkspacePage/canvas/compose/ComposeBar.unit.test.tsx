import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { ComposeBar } from "./ComposeBar";

const mutateMock = vi.fn();

vi.mock("@refinedev/core", () => ({ useUpdate: () => ({ mutate: mutateMock }) }));

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
  beforeEach(() => mutateMock.mockReset());

  it("stays hidden until two nodes are selected", () => {
    const store = createCanvasStore({ nodes: [makeNode("a"), makeNode("b")] });
    store.getState().setSelectedIds(["a"]);
    render(<ComposeBar pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-compose-bar")).not.toBeInTheDocument();
  });

  it("stays hidden for child nodes inside a compound", () => {
    const store = createCanvasStore({
      nodes: [
        { ...makeNode("a"), parentId: "compound-1" },
        { ...makeNode("b"), parentId: "compound-1" },
      ],
    });
    store.getState().setSelectedIds(["a", "b"]);
    render(<ComposeBar pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-compose-bar")).not.toBeInTheDocument();
  });

  it("composes the selection and persists the snapshot", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [makeNode("a"), makeNode("b")] });
    store.getState().setSelectedIds(["a", "b"]);
    render(<ComposeBar pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-compose-action"));

    expect(store.getState().nodes.some((node) => node.type === "compound")).toBe(true);
    expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({ id: "pipeline-1" }));
  });
});
