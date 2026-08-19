import { render } from "../../../test/test-wrapper";
import type * as RefineCore from "@refinedev/core";
import { screen, waitFor } from "@testing-library/react";
import { useStore } from "zustand";
import { describe, expect, it, vi } from "vitest";
import type { Job } from "@repo/schemas";
import { CanvasPageStoreProvider, useCanvasPageStore } from "../_store";
import { RunStateRestorer } from "./RunStateRestorer";

const jobs: Job[] = [];

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useList: () => ({ result: { data: jobs } }),
}));

const makeJob = (input: Partial<Job> & Pick<Job, "id" | "pipelineId" | "status">): Job => ({
  error: null,
  finishedAt: input.status === "done" ? new Date("2026-08-14T10:02:00.000Z") : null,
  id: input.id,
  meta: {
    createdAt: input.meta?.createdAt ?? new Date("2026-08-14T10:00:00.000Z"),
    updatedAt: input.meta?.updatedAt ?? new Date("2026-08-14T10:02:00.000Z"),
  },
  nodeStatuses: input.nodeStatuses ?? null,
  parentJobId: null,
  pipelineId: input.pipelineId,
  startedAt: input.startedAt ?? new Date("2026-08-14T10:00:00.000Z"),
  status: input.status,
  title: "Pipeline run",
  type: "pipeline_run",
});

const RunStateProbe = () => {
  const store = useCanvasPageStore();
  const activeJobId = useStore(store, (value) => value.activeJobId);
  const isConsoleOpen = useStore(store, (value) => value.isConsoleOpen);
  const statuses = useStore(store, (value) => value.nodeRunStatuses);

  return (
    <output data-testid="run-state">
      {JSON.stringify({ activeJobId, isConsoleOpen, statuses })}
    </output>
  );
};

const wrapper = ({ children }: React.PropsWithChildren) => (
  <CanvasPageStoreProvider pipeline={{ id: "pipe-1", name: "Pipeline", nodes: [], edges: [] }}>
    {children}
  </CanvasPageStoreProvider>
);

describe("RunStateRestorer", () => {
  it("restores the latest completed job statuses after a refresh", async () => {
    jobs.splice(
      0,
      jobs.length,
      makeJob({
        id: "older-run",
        pipelineId: "pipe-1",
        status: "done",
        nodeStatuses: { operation: "failed" },
      }),
      makeJob({
        id: "latest-run",
        meta: {
          createdAt: new Date("2026-08-14T11:00:00.000Z"),
          updatedAt: new Date("2026-08-14T11:02:00.000Z"),
        },
        pipelineId: "pipe-1",
        status: "done",
        nodeStatuses: { operation: "done" },
      }),
      makeJob({ id: "other-pipeline", pipelineId: "pipe-2", status: "running" }),
    );

    render(
      <>
        <RunStateRestorer />
        <RunStateProbe />
      </>,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId("run-state")).toHaveTextContent('"operation":"done"');
    });
    expect(screen.getByTestId("run-state")).toHaveTextContent('"activeJobId":null');
    expect(screen.getByTestId("run-state")).toHaveTextContent('"isConsoleOpen":false');
  });

  it("reattaches a running job so polling continues after a refresh", async () => {
    jobs.splice(
      0,
      jobs.length,
      makeJob({
        id: "live-run",
        pipelineId: "pipe-1",
        status: "running",
        nodeStatuses: { operation: "running" },
      }),
    );

    render(
      <>
        <RunStateRestorer />
        <RunStateProbe />
      </>,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId("run-state")).toHaveTextContent('"activeJobId":"live-run"');
    });
    expect(screen.getByTestId("run-state")).toHaveTextContent('"isConsoleOpen":true');
    expect(screen.getByTestId("run-state")).toHaveTextContent('"operation":"running"');
  });
});
