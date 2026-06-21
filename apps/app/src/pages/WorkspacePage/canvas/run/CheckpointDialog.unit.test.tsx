import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@repo/schemas";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { CheckpointDialog } from "./CheckpointDialog";

const customMock = vi.fn();

vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: { jobs: "jobs", pipelines: "pipelines" },
  dataProvider: {
    custom: (...args: unknown[]) => customMock(...args),
  },
}));

const operationNode: CanvasNode = {
  data: {
    checkpoint: true,
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

const waitingJob: Job = {
  error: null,
  finishedAt: null,
  id: "job-1",
  nodeStatuses: { "node-op": "waitingForUser" },
  parentJobId: null,
  pipelineId: "pipeline-1",
  projectId: null,
  startedAt: new Date(),
  status: "running",
  title: "Run",
  type: "pipeline_run",
};

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("CheckpointDialog", () => {
  beforeEach(() => {
    customMock.mockReset();
  });

  it("stays hidden without a waiting checkpoint", () => {
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<CheckpointDialog />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-checkpoint-dialog")).not.toBeInTheDocument();
  });

  it("resumes the job on approve", async () => {
    const user = userEvent.setup();
    customMock.mockResolvedValue({ data: { resumed: true } });
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().applyJobSnapshot(waitingJob);
    render(<CheckpointDialog />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("checkpoint-approve"));

    await waitFor(() => {
      expect(customMock).toHaveBeenCalledWith(
        expect.objectContaining({ payload: { jobId: "job-1" }, url: "jobs/resume" }),
      );
    });
    expect(store.getState().nodeRunStatuses["node-op"]).toBe("running");
  });

  it("opens the node config from Edit step and hides while editing", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    store.getState().applyJobSnapshot(waitingJob);
    render(<CheckpointDialog />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("checkpoint-edit"));

    expect(store.getState().configNodeId).toBe("node-op");
    expect(screen.queryByTestId("canvas-v2-checkpoint-dialog")).not.toBeInTheDocument();
  });
});
