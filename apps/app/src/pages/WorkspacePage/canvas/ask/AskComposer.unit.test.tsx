import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { AskComposer } from "./AskComposer";

const custom = vi.fn().mockResolvedValue({
  data: { diagnostics: [], proposal: null, reply: "Updated" },
});

vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({ custom }),
}));

const operationNode: CanvasNode = {
  data: {
    config: {},
    label: "Generate quiz",
    nodeType: "operation",
    operationId: "op-1",
    operationName: "Generate quiz",
    status: "idle",
  },
  id: "node-op",
  position: { x: 0, y: 0 },
  type: "operation",
};

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("AskComposer", () => {
  beforeEach(() => {
    custom.mockClear();
  });

  it("submits a node-anchored ask into the canvas contract", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().setAskNodeId("node-op");
    render(<AskComposer pipelineId="pipeline-1" pipelineName="Quiz" />, {
      wrapper: makeWrapper(store),
    });

    await user.type(screen.getByTestId("ask-composer-input"), "Make it stricter");
    await user.click(screen.getByTestId("ask-composer-send"));

    await waitFor(() => expect(store.getState().askNodeId).toBeNull());
    expect(custom).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          id: "pipeline-1",
          referencedNodeIds: ["node-op"],
        }),
        url: "pipelines/proposeActions",
      }),
    );
  });

  it("builds drill-scoped refs", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().pushDrillStack("compound-1");
    store.getState().setAskNodeId("node-op");
    render(<AskComposer pipelineId="pipeline-1" pipelineName="Quiz" />, {
      wrapper: makeWrapper(store),
    });

    await user.type(screen.getByTestId("ask-composer-input"), "Tighten this step");
    await user.click(screen.getByTestId("ask-composer-send"));

    await waitFor(() =>
      expect(custom).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            referencedNodeIds: ["compound-1/node-op"],
          }),
        }),
      ),
    );
  });
});
