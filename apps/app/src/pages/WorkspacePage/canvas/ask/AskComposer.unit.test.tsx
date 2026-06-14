import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { AskComposer } from "./AskComposer";

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
    useWorkspaceStore.getState().resetWorkspace();
  });

  it("stays hidden without an ask target", () => {
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<AskComposer />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-ask-composer")).not.toBeInTheDocument();
  });

  it("submits a node-anchored ask into the workspace store", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().setAskNodeId("node-op");
    render(<AskComposer />, { wrapper: makeWrapper(store) });

    await user.type(screen.getByTestId("ask-composer-input"), "Make the distractors harder");
    await user.click(screen.getByTestId("ask-composer-send"));

    const pendingAsk = useWorkspaceStore.getState().pendingAsk;
    expect(pendingAsk?.text).toBe("Make the distractors harder");
    expect(pendingAsk?.ref).toMatchObject({ baseId: "node-op", type: "node" });
    expect(store.getState().askNodeId).toBeNull();
  });

  it("builds drill-scoped refs inside a compound", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().pushDrillStack("compound-1");
    store.getState().setAskNodeId("node-op");
    render(<AskComposer />, { wrapper: makeWrapper(store) });

    await user.type(screen.getByTestId("ask-composer-input"), "Tighten this step");
    await user.click(screen.getByTestId("ask-composer-send"));

    expect(useWorkspaceStore.getState().pendingAsk?.ref).toMatchObject({
      id: "compound-1/node-op",
      path: ["compound-1"],
    });
  });
});
