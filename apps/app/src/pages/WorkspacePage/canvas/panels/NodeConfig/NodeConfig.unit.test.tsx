import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CanvasStoreContext,
  createCanvasStore,
  type CanvasStore,
} from "../../_store/canvasStore";
import type { CanvasNode } from "../../_store/canvasTypes";
import { NodeConfig } from "./NodeConfig";

const mutateMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: [], total: 0 } }),
  useUpdate: () => ({ mutate: mutateMock }),
}));

const operationNode: CanvasNode = {
  data: {
    config: {},
    label: "Parse",
    nodeType: "operation",
    operationId: "op-1",
    operationName: "Parse",
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

describe("NodeConfig", () => {
  beforeEach(() => {
    mutateMock.mockReset();
  });

  it("renders nothing while no node is being configured", () => {
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-node-config")).not.toBeInTheDocument();
  });

  it("patches the label and persists the pipeline", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.type(screen.getByTestId("node-config-label"), "!");

    const data = store.getState().nodes[0]?.data as { label: string; operationName: string };
    expect(data.label).toBe("Parse!");
    expect(data.operationName).toBe("Parse!");
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pipeline-1", values: expect.objectContaining({ nodes: expect.anything() }) }),
    );
  });

  it("toggles the checkpoint flag", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("node-config-checkpoint"));

    expect((store.getState().nodes[0]?.data as { checkpoint?: boolean }).checkpoint).toBe(true);
  });

  it("resets edits back to the open snapshot", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.type(screen.getByTestId("node-config-label"), "!");
    await user.click(screen.getByTestId("node-config-reset"));

    expect((store.getState().nodes[0]?.data as { label: string }).label).toBe("Parse");
  });

  it("closes via Done", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("node-config-done"));

    expect(store.getState().configNodeId).toBeNull();
  });
});
