import { useRef } from "react";
import type * as RefineCore from "@refinedev/core";
import { screen, waitFor } from "@testing-library/react";
import { useStore } from "zustand";
import { describe, expect, it, vi } from "vitest";
import type { AgentRunEventEnvelope, Job } from "@repo/schemas";
import { render } from "../../../test/test-wrapper";
import { CanvasPageStoreProvider, useCanvasPageStore } from "../_store";
import { CanvasRunEventSynchronizer } from "./CanvasRunEventSynchronizer";

const consumeAgentRunEventStream = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/agentRunEventsClient", () => ({ consumeAgentRunEventStream }));

const job: Job = {
  id: "job-1",
  title: "Pipeline run",
  type: "pipeline_run",
  status: "done",
  error: null,
  meta: { createdAt: new Date(), updatedAt: new Date() },
  startedAt: new Date(),
  finishedAt: new Date(),
  parentJobId: null,
  pipelineId: "pipe-1",
  nodeStatuses: { "node-1": "done" },
};

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useDataProvider: () => () => ({
    getOne: vi.fn(async () => ({ data: job })),
    custom: vi.fn(async () => ({
      data: {
        traces: [
          { id: 4, message: "@@NODE_DONE::node-1" },
          { id: 3, message: "@@LLM_CONTENT::node-1::trace fallback" },
          { id: 2, message: "@@AGENT_RUN::node-1::run-1" },
          { id: 1, message: "@@NODE_START::node-1" },
        ],
      },
    })),
  }),
}));

const StoreActivator = ({ children }: React.PropsWithChildren) => {
  const store = useCanvasPageStore();
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    store.setState({ runSyncJobId: "job-1", isConsoleOpen: false });
  }

  return children;
};

const Probe = () => {
  const store = useCanvasPageStore();
  const activities = useStore(store, (state) => state.nodeAgentActivities["node-1"]);
  const content = useStore(store, (state) => state.nodeLlmContent["node-1"]);
  const isConsoleOpen = useStore(store, (state) => state.isConsoleOpen);
  const runIds = useStore(store, (state) => state.nodeAgentRunIds["node-1"]);
  const status = useStore(store, (state) => state.nodeRunStatuses["node-1"]);
  const value = {
    activities: activities?.map((entry) => entry.kind) ?? [],
    content: content ?? "",
    isConsoleOpen,
    runIds: runIds ?? [],
    status: status ?? "missing",
  };

  return <output data-testid="sync-state">{JSON.stringify(value)}</output>;
};

const wrapper = ({ children }: React.PropsWithChildren) => (
  <CanvasPageStoreProvider>
    <StoreActivator>{children}</StoreActivator>
  </CanvasPageStoreProvider>
);

describe("CanvasRunEventSynchronizer", () => {
  it("replays a completed run while the console is closed", async () => {
    consumeAgentRunEventStream.mockImplementation(
      async (
        _platform: unknown,
        input: {
          after?: number;
          onEnvelope: (envelope: AgentRunEventEnvelope) => Promise<void> | void;
        },
      ) => {
        const events: AgentRunEventEnvelope[] = [
          {
            runId: "run-1",
            sequence: 1,
            createdAt: "2026-08-24T00:00:00.000Z",
            event: {
              type: "status",
              runtime: "codex",
              timestamp: "2026-08-24T00:00:00.000Z",
              phase: "running",
              message: "Codex turn started",
            },
          },
          {
            runId: "run-1",
            sequence: 2,
            createdAt: "2026-08-24T00:00:01.000Z",
            event: {
              type: "tool_start",
              runtime: "codex",
              timestamp: "2026-08-24T00:00:01.000Z",
              id: "tool-1",
              name: "Read",
            },
          },
          {
            runId: "run-1",
            sequence: 3,
            createdAt: "2026-08-24T00:00:02.000Z",
            event: {
              type: "message",
              runtime: "codex",
              timestamp: "2026-08-24T00:00:02.000Z",
              text: "Replayed result",
            },
          },
          {
            runId: "run-1",
            sequence: 4,
            createdAt: "2026-08-24T00:00:03.000Z",
            event: {
              type: "terminal",
              runtime: "codex",
              timestamp: "2026-08-24T00:00:03.000Z",
              status: "completed",
              resultText: "",
            },
          },
        ];
        for (const envelope of events) await input.onEnvelope(envelope);

        return { lastSequence: 4, terminalStatus: "completed" as const };
      },
    );

    render(
      <>
        <CanvasRunEventSynchronizer />
        <Probe />
      </>,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId("sync-state")).toHaveTextContent("Replayed result");
    });
    expect(screen.getByTestId("sync-state")).toHaveTextContent('"isConsoleOpen":false');
    expect(screen.getByTestId("sync-state")).toHaveTextContent('"runIds":["run-1"]');
    expect(screen.getByTestId("sync-state")).not.toHaveTextContent("trace fallback");
    expect(screen.getByTestId("sync-state")).toHaveTextContent(
      '"activities":["status","tool","terminal"]',
    );
    expect(consumeAgentRunEventStream).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ runId: "run-1", after: 0 }),
    );
  });
});
