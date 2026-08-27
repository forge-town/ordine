import { createStore, type StoreApi } from "zustand/vanilla";
import { z } from "zod/v4";
import {
  AgentRunActivityMetricsSchema,
  AgentRunActivitySnapshotSchema,
  AgentRunEventEnvelopeSchema,
  AgentRunSchema,
  RuntimeCapabilitiesSchema,
  createInitialAgentRunActivitySnapshot,
  type AgentRun,
  type AgentRunActivityMetrics,
  type AgentRunActivitySnapshot,
  type AgentRunEventEnvelope,
  type AgentRunStatus,
  type RuntimeCapabilities,
} from "@repo/schemas";
import { reduceAgentRunActivity } from "@repo/agent-activity";
import {
  consumeAgentRunEventStream,
  type AgentRunEventsTransport,
} from "../../lib/agentRunEventsClient";

const TERMINAL_STATUSES = new Set<AgentRunStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
const POLL_INTERVAL_MS = 1_000;
const SSE_RETRY_INTERVAL_MS = 15_000;
const MAX_EVENTS_PER_POLL = 200;
const EMPTY_METRICS = AgentRunActivityMetricsSchema.parse({});
const AgentRunEventPageSchema = z.object({
  events: z.array(AgentRunEventEnvelopeSchema),
  nextSequence: z.number().int().nonnegative(),
  terminal: z.boolean(),
});

export type AgentActivityConnection =
  | "idle"
  | "hydrating"
  | "streaming"
  | "polling"
  | "error"
  | "terminal";

export type AgentActivityState = {
  runId: string;
  runtime: AgentRun["runtime"] | null;
  status: AgentRunStatus | null;
  capabilities: RuntimeCapabilities | null;
  snapshot: AgentRunActivitySnapshot | null;
  metrics: AgentRunActivityMetrics;
  connection: AgentActivityConnection;
  lastSequence: number;
  consecutiveSseFailures: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number;
  cancel: () => Promise<void>;
};

export type AgentActivityStore = StoreApi<AgentActivityState>;

type AgentActivityListener = (envelope: AgentRunEventEnvelope) => Promise<void> | void;

type ActivityEntry = {
  store: AgentActivityStore;
  refs: number;
  started: boolean;
  destroyed: boolean;
  controller: AbortController | null;
  sseInFlight: boolean;
  pollTimer: ReturnType<typeof setInterval> | null;
  sseRetryTimer: ReturnType<typeof setTimeout> | null;
  elapsedTimer: ReturnType<typeof setInterval> | null;
  platform: AgentRunEventsTransport;
  listeners: Set<AgentActivityListener>;
  deliveryQueue: Promise<void>;
};

const registry = new Map<string, ActivityEntry>();

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const parseJson = async (response: Response): Promise<unknown> => {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const requestRun = async (platform: AgentRunEventsTransport, runId: string): Promise<AgentRun> => {
  const response = await platform.request(
    `${platform.apiBaseUrl}/agent-runs/${encodeURIComponent(runId)}`,
  );
  const body = await parseJson(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `Agent run hydration failed with status ${response.status}`;
    throw new Error(message);
  }

  return AgentRunSchema.parse(body);
};

const setElapsed = (entry: ActivityEntry): void => {
  const state = entry.store.getState();
  if (!state.startedAt || (state.status && TERMINAL_STATUSES.has(state.status))) return;
  const started = Date.parse(state.startedAt);
  if (!Number.isFinite(started)) return;
  entry.store.setState({ elapsedMs: Math.max(0, Date.now() - started) });
};

const applyEnvelope = (entry: ActivityEntry, envelope: AgentRunEventEnvelope): Promise<void> => {
  const deliver = async () => {
    const state = entry.store.getState();
    if (envelope.runId !== state.runId) return;
    const current = state.snapshot;
    if (!current) return;
    const reduction = reduceAgentRunActivity(current, envelope);
    if (!reduction.accepted) {
      if (reduction.duplicate) {
        entry.store.setState((previous) => ({
          metrics: {
            ...previous.metrics,
            duplicateEventCount: previous.metrics.duplicateEventCount + 1,
          },
        }));
      }

      return;
    }
    const terminal = envelope.event.type === "terminal" ? envelope.event.status : null;
    entry.store.setState((previous) => ({
      snapshot: reduction.snapshot,
      status: terminal ?? previous.status,
      lastSequence: reduction.snapshot.latestSequence,
      consecutiveSseFailures: 0,
      connection: terminal ? "terminal" : "streaming",
      error:
        envelope.event.type === "diagnostic" && envelope.event.level === "error"
          ? envelope.event.message
          : previous.error,
      finishedAt: terminal ? envelope.createdAt : previous.finishedAt,
    }));
    for (const listener of entry.listeners) {
      try {
        await listener(envelope);
      } catch {
        // A view subscriber must not stop delivery to the shared activity store.
      }
    }
    if (terminal) stopTransport(entry);
  };

  // SSE chunks and polling can overlap around reconnects. Serialize reducer and
  // subscriber delivery so control events (draft/apply/terminal) retain order.
  const next = entry.deliveryQueue.catch(() => undefined).then(deliver);
  entry.deliveryQueue = next;

  return next;
};

const stopTransport = (entry: ActivityEntry): void => {
  entry.controller?.abort();
  entry.controller = null;
  if (entry.pollTimer) clearInterval(entry.pollTimer);
  if (entry.sseRetryTimer) clearTimeout(entry.sseRetryTimer);
  if (entry.elapsedTimer) clearInterval(entry.elapsedTimer);
  entry.pollTimer = null;
  entry.sseRetryTimer = null;
  entry.elapsedTimer = null;
  entry.sseInFlight = false;
};

const clearPollingTimers = (entry: ActivityEntry): void => {
  if (entry.pollTimer) clearInterval(entry.pollTimer);
  if (entry.sseRetryTimer) clearTimeout(entry.sseRetryTimer);
  entry.pollTimer = null;
  entry.sseRetryTimer = null;
};

const scheduleSseRetry = (entry: ActivityEntry, delayMs: number): void => {
  if (entry.sseRetryTimer || entry.destroyed || entry.refs === 0) return;
  entry.sseRetryTimer = setTimeout(() => {
    entry.sseRetryTimer = null;
    void startSse(entry);
  }, delayMs);
};

const markSseFailure = (entry: ActivityEntry, error: Error): void => {
  const failures = entry.store.getState().consecutiveSseFailures + 1;
  entry.store.setState({
    connection: failures >= 3 ? "polling" : "error",
    consecutiveSseFailures: failures,
    error: error.message,
    metrics: {
      ...entry.store.getState().metrics,
      reconnectCount: entry.store.getState().metrics.reconnectCount + 1,
      ...(failures === 3
        ? {
            pollingFallbackCount: entry.store.getState().metrics.pollingFallbackCount + 1,
          }
        : {}),
    },
  });
  if (failures >= 3) {
    startPolling(entry);
    scheduleSseRetry(entry, SSE_RETRY_INTERVAL_MS);
  } else scheduleSseRetry(entry, 1_000);
};

const pollOnce = async (entry: ActivityEntry): Promise<void> => {
  if (entry.destroyed || entry.sseInFlight) return;
  const state = entry.store.getState();
  const response = await entry.platform.request(
    `${entry.platform.apiBaseUrl}/agent-runs/${encodeURIComponent(entry.store.getState().runId)}/events?after=${state.lastSequence}&limit=${MAX_EVENTS_PER_POLL}`,
    {
      headers: { accept: "application/json" },
      signal: entry.controller?.signal,
    },
  );
  const body = await parseJson(response);
  if (!response.ok) throw new Error(`Agent event polling failed with status ${response.status}`);
  const page = AgentRunEventPageSchema.safeParse(body);
  if (!page.success) throw new Error("Agent event polling returned invalid JSON");
  for (const envelope of page.data.events) await applyEnvelope(entry, envelope);
  if (page.data.terminal && entry.store.getState().connection !== "terminal") {
    entry.store.setState({ connection: "terminal" });
    stopTransport(entry);
  }
};

const startPolling = (entry: ActivityEntry): void => {
  if (entry.pollTimer || entry.destroyed || entry.refs === 0) return;
  entry.store.setState({ connection: "polling" });
  entry.pollTimer = setInterval(() => {
    void pollOnce(entry).catch((error: unknown) => {
      entry.store.setState({ error: toError(error).message });
    });
  }, POLL_INTERVAL_MS);
  scheduleSseRetry(entry, SSE_RETRY_INTERVAL_MS);
  void pollOnce(entry).catch((error: unknown) => {
    entry.store.setState({ error: toError(error).message });
  });
};

const startSse = async (entry: ActivityEntry): Promise<void> => {
  if (entry.destroyed || entry.sseInFlight || entry.refs === 0) return;
  const state = entry.store.getState();
  if (state.status && TERMINAL_STATUSES.has(state.status)) {
    stopTransport(entry);

    return;
  }
  entry.sseInFlight = true;
  const controller = new AbortController();
  entry.controller = controller;
  entry.store.setState({ connection: "streaming" });
  try {
    const result = await consumeAgentRunEventStream(entry.platform, {
      runId: entry.store.getState().runId,
      after: entry.store.getState().lastSequence,
      signal: controller.signal,
      onConnected: () => {
        clearPollingTimers(entry);
        if (!entry.destroyed) entry.store.setState({ connection: "streaming" });
      },
      onEnvelope: (envelope) => applyEnvelope(entry, envelope),
    });
    if (!entry.destroyed && !controller.signal.aborted && !result.terminalStatus) {
      markSseFailure(entry, new Error("Agent event stream ended before terminal state"));
    }
  } catch (error: unknown) {
    if (!entry.destroyed && !controller.signal.aborted) markSseFailure(entry, toError(error));
  } finally {
    entry.sseInFlight = false;
    if (entry.controller === controller) entry.controller = null;
  }
};

const hydrate = async (entry: ActivityEntry): Promise<void> => {
  entry.store.setState({ connection: "hydrating", error: null });
  const run = await requestRun(entry.platform, entry.store.getState().runId);
  if (entry.destroyed || entry.refs === 0) return;
  const snapshot = run.activitySnapshot
    ? AgentRunActivitySnapshotSchema.parse(run.activitySnapshot)
    : createInitialAgentRunActivitySnapshot(run.id, run.runtime, run.status);
  const metrics = run.activityMetrics
    ? AgentRunActivityMetricsSchema.parse(run.activityMetrics)
    : EMPTY_METRICS;
  const capabilities = run.runtimeCapabilities
    ? RuntimeCapabilitiesSchema.parse(run.runtimeCapabilities)
    : null;
  entry.store.setState({
    runtime: run.runtime,
    status: run.status,
    capabilities,
    snapshot,
    metrics,
    lastSequence: snapshot.latestSequence,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    elapsedMs:
      run.startedAt && run.finishedAt
        ? Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt))
        : 0,
  });
  if (TERMINAL_STATUSES.has(run.status)) {
    entry.store.setState({ connection: "terminal" });

    return;
  }
  entry.elapsedTimer = setInterval(() => setElapsed(entry), 1_000);
  if (entry.refs === 0) return;
  await startSse(entry);
};

const createEntry = (runId: string, platform: AgentRunEventsTransport): ActivityEntry => {
  const entry = {} as ActivityEntry;
  const store = createStore<AgentActivityState>(() => ({
    runId,
    runtime: null,
    status: null,
    capabilities: null,
    snapshot: null,
    metrics: EMPTY_METRICS,
    connection: "idle",
    lastSequence: 0,
    consecutiveSseFailures: 0,
    error: null,
    startedAt: null,
    finishedAt: null,
    elapsedMs: 0,
    cancel: async () => {
      const current = store.getState();
      if (!current.capabilities || current.capabilities.cancellation === "none") return;
      const response = await platform.request(
        `${platform.apiBaseUrl}/agent-runs/${encodeURIComponent(runId)}/cancel`,
        { method: "POST" },
      );
      const body = await parseJson(response);
      if (!response.ok) throw new Error(`Agent cancellation failed with status ${response.status}`);
      const run = AgentRunSchema.parse(body);
      store.setState({ status: run.status, finishedAt: run.finishedAt });
    },
  }));
  entry.store = store;
  entry.refs = 0;
  entry.started = false;
  entry.destroyed = false;
  entry.controller = null;
  entry.sseInFlight = false;
  entry.pollTimer = null;
  entry.sseRetryTimer = null;
  entry.elapsedTimer = null;
  entry.platform = platform;
  entry.listeners = new Set();
  entry.deliveryQueue = Promise.resolve();

  return entry;
};

export const getAgentActivityEntry = (
  runId: string,
  platform: AgentRunEventsTransport,
): ActivityEntry => {
  const existing = registry.get(runId);
  if (existing) return existing;
  const entry = createEntry(runId, platform);
  registry.set(runId, entry);

  return entry;
};

export const recordAgentActivityArtifactOpenFailure = (
  runId: string,
  platform: AgentRunEventsTransport,
): void => {
  const entry = getAgentActivityEntry(runId, platform);
  entry.store.setState((state) => ({
    metrics: {
      ...state.metrics,
      artifactOpenFailureCount: state.metrics.artifactOpenFailureCount + 1,
    },
  }));
  void platform
    .request(`${platform.apiBaseUrl}/agent-runs/${encodeURIComponent(runId)}/activity/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "artifact_open_failed" }),
    })
    .catch(() => undefined);
};

export const acquireAgentActivity = (entry: ActivityEntry): (() => void) => {
  entry.refs += 1;
  if (!entry.started) {
    entry.started = true;
    void hydrate(entry).catch((error: unknown) => {
      if (!entry.destroyed)
        entry.store.setState({ connection: "error", error: toError(error).message });
    });
  }
  let released = false;

  return () => {
    if (released) return;
    released = true;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0) {
      stopTransport(entry);
      entry.started = false;
    }
  };
};

/**
 * Subscribe to the canonical envelope stream while sharing the same run-level
 * transport and reducer used by React consumers. The returned release function
 * also releases the underlying reference-counted stream.
 */
export const subscribeAgentActivity = (
  runId: string,
  platform: AgentRunEventsTransport,
  listener: AgentActivityListener,
): (() => void) => {
  const entry = getAgentActivityEntry(runId, platform);
  entry.listeners.add(listener);
  const release = acquireAgentActivity(entry);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    entry.listeners.delete(listener);
    release();
  };
};

const activityViewModelCache = new WeakMap<object, AgentActivityViewModel>();

const createAgentActivityViewModel = (state: AgentActivityState) => {
  const snapshot = state.snapshot;
  const terminal = Boolean(state.status && TERMINAL_STATUSES.has(state.status));

  return {
    runId: state.runId,
    runtime: state.runtime,
    status: state.status,
    phase: snapshot?.phase ?? "queued",
    content: snapshot?.content ?? "",
    progressMessage: snapshot?.progressMessage ?? null,
    elapsedMs: state.elapsedMs,
    tools: [...(snapshot?.activeTools ?? []), ...(snapshot?.completedTools ?? [])],
    activeTools: snapshot?.activeTools ?? [],
    completedTools: snapshot?.completedTools ?? [],
    artifacts: snapshot?.artifacts ?? [],
    usage: snapshot?.usage ?? null,
    terminal: snapshot?.terminalMessage ?? null,
    connection: state.connection,
    lastSequence: state.lastSequence,
    error: state.error,
    capabilities: state.capabilities,
    canCancel:
      !terminal && state.status !== "cancelling" && state.capabilities?.cancellation !== "none",
    canPause:
      !terminal && state.capabilities?.pause !== undefined && state.capabilities.pause !== "none",
    canResume:
      terminal && state.capabilities?.resume !== undefined && state.capabilities.resume !== "none",
    cancel: state.cancel,
    waitingForFirstOutput:
      !terminal &&
      state.connection === "streaming" &&
      !snapshot?.content &&
      (snapshot?.items.length ?? 0) === 0,
  };
};

export type AgentActivityViewModel = ReturnType<typeof createAgentActivityViewModel>;

/**
 * Zustand's React adapter reads a selector more than once during a render.
 * Cache the derived object for each immutable store state so the snapshot
 * identity remains stable even though the view model contains derived arrays.
 */
export const selectAgentActivityViewModel = (
  state: AgentActivityState,
): AgentActivityViewModel => {
  const cached = activityViewModelCache.get(state);
  if (cached) return cached;
  const viewModel = createAgentActivityViewModel(state);
  activityViewModelCache.set(state, viewModel);

  return viewModel;
};
