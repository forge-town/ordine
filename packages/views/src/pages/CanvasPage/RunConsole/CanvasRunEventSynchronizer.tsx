import { useEffect, useRef } from "react";
import { useDataProvider } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useStore } from "zustand";
import type { Job, JobStatus } from "@repo/schemas";
import { consumeAgentRunEventStream } from "../../../lib/agentRunEventsClient";
import { usePlatform } from "../../../platform";
import { ResourceName } from "../../../constants";
import { useCanvasPageStore } from "../_store";
import { parseCanvasRunTraceEvents } from "./canvasRunTraceEvents";

const POLL_INTERVAL_MS = 1_500;
const RECONNECT_INTERVAL_MS = 500;

type RunTrace = { id: number; message: string };

const isTerminalStatus = (status: JobStatus): boolean =>
  status === "done" ||
  status === "failed" ||
  status === "cancelled" ||
  status === "expired" ||
  status === "skipped";

const waitForReconnect = (signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();

      return;
    }
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      resolve();
    };
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, RECONNECT_INTERVAL_MS);
    signal.addEventListener("abort", onAbort, { once: true });
  });

export const CanvasRunEventSynchronizer = () => {
  const platform = usePlatform();
  const getDataProvider = useDataProvider();
  const store = useCanvasPageStore();
  const jobId = useStore(store, (state) => state.runSyncJobId);
  const applyNodeAgentActivity = useStore(store, (state) => state.applyNodeAgentActivity);
  const applyNodeLlmContent = useStore(store, (state) => state.applyNodeLlmContent);
  const applyNodeRuntimeEvent = useStore(store, (state) => state.applyNodeRuntimeEvent);
  const markNodeFailed = useStore(store, (state) => state.markNodeFailed);
  const markNodePassed = useStore(store, (state) => state.markNodePassed);
  const markNodeRunning = useStore(store, (state) => state.markNodeRunning);
  const registerNodeAgentRun = useStore(store, (state) => state.registerNodeAgentRun);
  const setNodeRunStatuses = useStore(store, (state) => state.setNodeRunStatuses);
  const stopTestRun = useStore(store, (state) => state.stopTestRun);
  const dependenciesRef = useRef({
    applyNodeAgentActivity,
    applyNodeLlmContent,
    applyNodeRuntimeEvent,
    markNodeFailed,
    markNodePassed,
    markNodeRunning,
    registerNodeAgentRun,
    setNodeRunStatuses,
    stopTestRun,
  });
  dependenciesRef.current = {
    applyNodeAgentActivity,
    applyNodeLlmContent,
    applyNodeRuntimeEvent,
    markNodeFailed,
    markNodePassed,
    markNodeRunning,
    registerNodeAgentRun,
    setNodeRunStatuses,
    stopTestRun,
  };

  useEffect(() => {
    if (!jobId) return;
    const dataProvider = getDataProvider();
    const abortController = new AbortController();
    const state = {
      directNodes: new Set<string>(),
      lastProcessedTraceId: 0,
      streamRunIds: new Set<string>(),
      timer: null as ReturnType<typeof globalThis.setTimeout> | null,
    };

    const startAgentRunStream = (nodeId: string, runId: string) => {
      const actions = dependenciesRef.current;
      actions.registerNodeAgentRun(nodeId, runId);
      state.directNodes.add(nodeId);
      if (state.streamRunIds.has(runId)) return;
      state.streamRunIds.add(runId);

      const stream = async () => {
        const streamState = { lastSequence: 0, terminal: false };
        while (!abortController.signal.aborted && !streamState.terminal) {
          const consumed = await ResultAsync.fromPromise(
            consumeAgentRunEventStream(platform, {
              runId,
              after: streamState.lastSequence,
              signal: abortController.signal,
              onEnvelope: (envelope) => {
                dependenciesRef.current.applyNodeRuntimeEvent(nodeId, runId, envelope.event);
              },
            }),
            (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
          );
          consumed.match(
            (value) => {
              streamState.lastSequence = value.lastSequence;
              streamState.terminal = value.terminalStatus !== null;
            },
            (error) => {
              if (abortController.signal.aborted) return;
              dependenciesRef.current.applyNodeAgentActivity(nodeId, {
                id: `${runId}:stream-error`,
                kind: "diagnostic",
                title: "Agent event stream disconnected",
                detail: error.message,
              });
            },
          );
          if (!streamState.terminal && !abortController.signal.aborted) {
            await waitForReconnect(abortController.signal);
          }
        }
      };

      void stream();
    };

    const applyTraceEvents = (traces: readonly RunTrace[]) => {
      const freshTraces = traces
        .filter((trace) => trace.id > state.lastProcessedTraceId)
        .sort((left, right) => left.id - right.id);
      if (freshTraces.length === 0) return;
      state.lastProcessedTraceId = freshTraces.at(-1)!.id;
      const events = parseCanvasRunTraceEvents(freshTraces.map((trace) => trace.message));

      // The traces API is newest-first. Discover persistent Agent Runs before
      // projecting any fallback text/events from the same response so replay
      // cannot render both sources.
      for (const event of events) {
        if (event.type === "agent_run") startAgentRunStream(event.nodeId, event.runId);
      }
      for (const event of events) {
        const actions = dependenciesRef.current;
        if (event.type === "node_start") actions.markNodeRunning(event.nodeId);
        if (event.type === "node_done") actions.markNodePassed(event.nodeId);
        if (event.type === "node_fail") actions.markNodeFailed(event.nodeId);
        if (event.type === "llm_content" && !state.directNodes.has(event.nodeId)) {
          actions.applyNodeLlmContent(event.nodeId, event.content);
        }
        if (event.type === "agent_event" && !state.directNodes.has(event.nodeId)) {
          actions.applyNodeRuntimeEvent(event.nodeId, `legacy:${jobId}`, event.event);
        }
      }
    };

    const synchronize = async (): Promise<boolean> => {
      const result = await ResultAsync.fromPromise(
        Promise.all([
          dataProvider.getOne!<Job>({ resource: ResourceName.jobs, id: jobId }),
          dataProvider.custom!<{ traces: RunTrace[] }>({
            url: "jobs/traces",
            method: "get",
            payload: { jobId },
          }),
        ]),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );

      return result.match(
        ([jobResponse, tracesResponse]) => {
          const job = jobResponse.data;
          if (job.nodeStatuses) dependenciesRef.current.setNodeRunStatuses(job.nodeStatuses);
          applyTraceEvents(tracesResponse.data.traces);
          if (isTerminalStatus(job.status)) dependenciesRef.current.stopTestRun();

          return isTerminalStatus(job.status);
        },
        () => false,
      );
    };

    const scheduleSynchronization = () => {
      void synchronize().then((terminal) => {
        if (!terminal && !abortController.signal.aborted) {
          state.timer = globalThis.setTimeout(scheduleSynchronization, POLL_INTERVAL_MS);
        }
      });
    };
    scheduleSynchronization();

    return () => {
      abortController.abort();
      if (state.timer) globalThis.clearTimeout(state.timer);
    };
  }, [getDataProvider, jobId, platform]);

  return null;
};
