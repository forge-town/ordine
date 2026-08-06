import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../../_store/canvasStore";
import type { CanvasNode } from "../../_store/canvasTypes";
import { toastStore } from "@/store/toastStore";
import { NodeConfig } from "./NodeConfig";

const mutateMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: [], total: 0 } }),
  useUpdate: () => ({ mutateAsync: mutateMock }),
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
    mutateMock.mockReset().mockResolvedValue({});
    toastStore.setState({ toasts: [] });
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
    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pipeline-1",
          values: expect.objectContaining({ edges: expect.anything(), nodes: expect.anything() }),
        }),
      ),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("toggles the checkpoint flag", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("node-config-checkpoint"));

    expect((store.getState().nodes[0]!.data as { checkpoint?: boolean }).checkpoint).toBe(true);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
  });

  it("resets edits back to the open snapshot", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.type(screen.getByTestId("node-config-label"), "!");
    await user.click(screen.getByTestId("node-config-reset"));

    expect((store.getState().nodes[0]!.data as { label: string }).label).toBe("Parse");
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
  });

  it("closes via Done", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-1" />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("node-config-done"));

    expect(store.getState().configNodeId).toBeNull();
  });

  it("reports a failed pipeline save", async () => {
    const user = userEvent.setup();
    mutateMock.mockRejectedValueOnce(new Error("offline"));
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().openNodeConfig("node-op");
    render(<NodeConfig pipelineId="pipeline-error" />, { wrapper: makeWrapper(store) });

    await user.type(screen.getByTestId("node-config-label"), "!");

    await waitFor(() => expect(toastStore.getState().toasts.at(-1)?.type).toBe("error"));
  });
});
