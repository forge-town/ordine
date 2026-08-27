import { useEffect, useRef } from "react";
import { useDataProvider } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useStore } from "zustand";
import {
  RuntimeEventSchema,
  type AgentRunActivitySnapshot,
  type Job,
  type JobStatus,
} from "@repo/schemas";
import {
  getAgentActivityEntry,
  subscribeAgentActivity,
} from "../../../components/AgentActivity/agentActivityStore";
import { usePlatform } from "../../../platform";
import { ResourceName } from "../../../constants";
import { useCanvasPageStore } from "../_store";
import { parseCanvasRunTraceEvents } from "./canvasRunTraceEvents";

const POLL_INTERVAL_MS = 1_500;

type RunTrace = { id: number; message: string };

const isTerminalStatus = (status: JobStatus): boolean =>
  status === "done" ||
  status === "failed" ||
  status === "cancelled" ||
  status === "expired" ||
  status === "skipped";

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
      activityReleases: new Map<string, () => void>(),
      timer: null as ReturnType<typeof globalThis.setTimeout> | null,
    };

    const startAgentRunStream = (nodeId: string, runId: string) => {
      const actions = dependenciesRef.current;
      actions.registerNodeAgentRun(nodeId, runId);
      state.directNodes.add(nodeId);
      const subscriptionKey = `${nodeId}:${runId}`;
      if (state.activityReleases.has(subscriptionKey)) return;
      const entry = getAgentActivityEntry(runId, platform);
      const applySnapshot = (snapshot: AgentRunActivitySnapshot) => {
        const current = dependenciesRef.current;
        if (snapshot.content) current.applyNodeLlmContent(nodeId, snapshot.content);
        else if (snapshot.terminalMessage) {
          current.applyNodeLlmContent(nodeId, snapshot.terminalMessage);
        }
        for (const tool of [...snapshot.activeTools, ...snapshot.completedTools]) {
          current.applyNodeAgentActivity(nodeId, {
            id: `${runId}:tool-${tool.id}`,
            kind: "tool",
            title: `${tool.name} · ${tool.status}`,
            timestamp: tool.completedAt ?? tool.startedAt,
          });
        }
        if (snapshot.terminalAt) {
          current.applyNodeAgentActivity(nodeId, {
            id: `${runId}:terminal`,
            kind: "terminal",
            title: `Run ${snapshot.status}`,
            timestamp: snapshot.terminalAt,
          });
        }
      };
      const unsubscribeSnapshot = entry.store.subscribe((next, previous) => {
        if (next.snapshot && next.snapshot !== previous.snapshot) applySnapshot(next.snapshot);
      });
      const hydratedSnapshot = entry.store.getState().snapshot;
      if (hydratedSnapshot) applySnapshot(hydratedSnapshot);
      const release = subscribeAgentActivity(runId, platform, (envelope) => {
        const runtimeEvent = RuntimeEventSchema.safeParse(envelope.event);
        if (runtimeEvent.success) {
          dependenciesRef.current.applyNodeRuntimeEvent(nodeId, runId, runtimeEvent.data);
        }
      });
      state.activityReleases.set(subscriptionKey, () => {
        unsubscribeSnapshot();
        release();
      });
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
      for (const release of state.activityReleases.values()) release();
      state.activityReleases.clear();
    };
  }, [getDataProvider, jobId, platform]);

  return null;
};
