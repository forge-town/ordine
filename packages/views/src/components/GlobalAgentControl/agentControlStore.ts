import { ResultAsync } from "neverthrow";
import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  AgentAction,
  AgentApproval,
  AgentChangeSet,
  AgentContextEnvelope,
  AgentControlCapabilities,
  AgentExecutionChoice,
  AgentResourceRef,
  AgentRunEventEnvelope,
  AgentThread,
  PipelineAction,
  PipelineGraphSnapshot,
} from "@repo/schemas";
import type {
  AgentControlClient,
  AgentThreadMessageClient,
  ChangeSetOperation,
} from "./agentControlClient";
import { adaptAgentControlEventToAgUi, type AgentControlAgUiEvent } from "./agUiEventAdapter";

const MAX_VISIBLE_EVENTS = 240;
const FOLLOW_UP_POLL_ATTEMPTS = 20;
const FOLLOW_UP_POLL_INTERVAL_MS = 500;

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

const emptyContext = (): AgentContextEnvelope => ({
  route: { pathname: globalThis.location?.pathname || "/" },
  projectId: null,
  pipelineId: null,
  selectedResources: [],
  selectedNodeIds: [],
  attachments: [],
  activeRun: null,
  capturedAt: new Date().toISOString(),
});

const contextChipKey = (resource: AgentResourceRef): string =>
  `resource:${resource.type}:${resource.id}`;

const filterContext = (
  context: AgentContextEnvelope,
  removed: ReadonlySet<string>,
): AgentContextEnvelope => ({
  ...context,
  route: removed.has("route") ? { pathname: "/" } : context.route,
  projectId: removed.has("project") ? null : context.projectId,
  pipelineId: removed.has("pipeline") ? null : context.pipelineId,
  selectedResources: context.selectedResources.filter(
    (resource) => !removed.has(contextChipKey(resource)),
  ),
  selectedNodeIds: removed.has("nodes") ? [] : context.selectedNodeIds,
  attachments: context.attachments.filter(
    (attachment) => !removed.has(`attachment:${attachment.id}`),
  ),
  capturedAt: new Date().toISOString(),
});

export type AgentControlCanvasSurface = {
  pipelineId: string;
  isOpen: boolean;
  openPanel: () => void;
  hydrateChangeSet: (changeSet: AgentChangeSet, appliedActionIds: string[]) => void;
  applyDraftAction: (input: {
    actionId: string;
    changeSetId: string;
    action: PipelineAction;
  }) => Promise<void> | void;
  rollbackChangeSet: (changeSetId: string) => void;
  commitChangeSet: (input: {
    changeSetId: string;
    previousVersion: number;
    newVersion: number;
  }) => void;
};

type ResourceInvalidator = (resources: AgentResourceRef[]) => Promise<void> | void;
type AgentNavigator = (pathname: string) => Promise<void> | void;

export type AgentControlState = {
  capabilities: AgentControlCapabilities | null;
  threads: AgentThread[];
  activeThreadId: string | null;
  messages: AgentThreadMessageClient[];
  events: AgentRunEventEnvelope[];
  agUiEvents: AgentControlAgUiEvent[];
  actions: AgentAction[];
  changeSets: AgentChangeSet[];
  approvals: AgentApproval[];
  context: AgentContextEnvelope;
  removedContextChips: string[];
  executionChoice: AgentExecutionChoice | null;
  selectedRuntimeId: string | null;
  currentRunId: string | null;
  streamingText: string;
  draft: string;
  isBootstrapping: boolean;
  isRunning: boolean;
  isDrawerOpen: boolean;
  error: string | null;
  canvasSurface: AgentControlCanvasSurface | null;
  isCanvasSurfaceOpen: boolean;
  bootstrap: () => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
  setDraft: (draft: string) => void;
  setDrawerOpen: (open: boolean) => void;
  setExecutionChoice: (choice: AgentExecutionChoice) => void;
  setSelectedRuntimeId: (runtimeId: string) => void;
  updateContext: (patch: Partial<AgentContextEnvelope>) => void;
  removeContextChip: (key: string) => void;
  restoreContextChips: () => void;
  registerCanvasSurface: (surface: AgentControlCanvasSurface | null) => void;
  setCanvasSurfaceOpen: (open: boolean) => void;
  registerInvalidator: (invalidator: ResourceInvalidator | null) => void;
  registerNavigator: (navigate: AgentNavigator | null) => void;
  openPreferredSurface: () => void;
  submit: () => Promise<void>;
  stop: () => Promise<void>;
  approve: (approvalId: string) => Promise<void>;
  rejectApproval: (approvalId: string) => Promise<void>;
  applyChangeSet: (changeSetId: string, expectedVersion: number) => Promise<void>;
  rejectChangeSet: (changeSetId: string) => Promise<void>;
  revertChangeSet: (
    changeSetId: string,
    expectedVersion: number,
  ) => Promise<{ snapshot: PipelineGraphSnapshot; newVersion: number }>;
  redoChangeSet: (
    changeSetId: string,
    expectedVersion: number,
  ) => Promise<{ snapshot: PipelineGraphSnapshot; newVersion: number }>;
};

export type AgentControlStore = StoreApi<AgentControlState>;

export const createAgentControlStore = (client: AgentControlClient): AgentControlStore => {
  const streamControllers = new Map<string, AbortController>();
  const lastSequences = new Map<string, number>();
  const integration = {
    invalidator: null as ResourceInvalidator | null,
    navigator: null as AgentNavigator | null,
  };
  let store: AgentControlStore;

  const hydrateCanvas = () => {
    const state = store.getState();
    const surface = state.canvasSurface;
    if (!surface) return;
    const changeSet = state.changeSets.find(
      (entry) =>
        entry.target.type === "pipeline" &&
        entry.target.id === surface.pipelineId &&
        ["drafting", "ready", "conflicted"].includes(entry.status),
    );
    if (changeSet) {
      surface.hydrateChangeSet(
        changeSet,
        state.actions
          .filter(
            (action) =>
              action.changeSetId === changeSet.id &&
              (action.status === "succeeded" || action.status === "replayed"),
          )
          .map((action) => action.id),
      );
    }
  };

  const refreshThreadData = async (threadId: string) => {
    const [messages, actions, changeSets, approvals] = await Promise.all([
      client.listMessages(threadId),
      client.listActions(threadId),
      client.listChangeSets(threadId),
      client.listApprovals(threadId),
    ]);
    if (store.getState().activeThreadId !== threadId) return;
    store.setState({
      messages,
      actions: [...actions].sort((left, right) => left.sequence - right.sequence),
      changeSets,
      approvals,
    });
    hydrateCanvas();
  };

  const refreshActions = async (threadId: string) => {
    const actions = await client.listActions(threadId);
    if (store.getState().activeThreadId !== threadId) return;
    store.setState({ actions: [...actions].sort((left, right) => left.sequence - right.sequence) });
  };

  const pollForFollowUp = async (threadId: string, previousRunId: string, attempt = 0) => {
    if (attempt >= FOLLOW_UP_POLL_ATTEMPTS) return;
    await wait(FOLLOW_UP_POLL_INTERVAL_MS);
    if (store.getState().activeThreadId !== threadId) return;
    const latest = await client.getLatestRun(threadId);
    if (latest && latest.id !== previousRunId) {
      const isRunning = !["completed", "failed", "cancelled", "timed_out", "interrupted"].includes(
        latest.status,
      );
      store.setState({
        currentRunId: latest.id,
        isRunning,
        context: {
          ...store.getState().context,
          activeRun: isRunning ? { runId: latest.id, status: latest.status } : null,
          capturedAt: new Date().toISOString(),
        },
      });
      startEventStream(threadId, latest.id);

      return;
    }

    return pollForFollowUp(threadId, previousRunId, attempt + 1);
  };

  const processEnvelope = async (threadId: string, envelope: AgentRunEventEnvelope) => {
    if (store.getState().activeThreadId !== threadId) return;
    lastSequences.set(envelope.runId, envelope.sequence);
    store.setState((state) => ({
      events: [
        ...state.events.filter(
          (entry) => entry.runId !== envelope.runId || entry.sequence !== envelope.sequence,
        ),
        envelope,
      ].slice(-MAX_VISIBLE_EVENTS),
      agUiEvents: [...state.agUiEvents, ...adaptAgentControlEventToAgUi(envelope)].slice(
        -MAX_VISIBLE_EVENTS,
      ),
    }));
    const event = envelope.event;
    if (event.type === "text_delta") {
      store.setState((state) => ({ streamingText: `${state.streamingText}${event.text}` }));
    } else if (event.type === "message") {
      store.setState({ streamingText: event.text });
    } else if (event.type === "diagnostic" && event.level === "error") {
      store.setState({ error: event.message });
    } else if (event.type === "draft_applied") {
      await store.getState().canvasSurface?.applyDraftAction({
        actionId: event.actionId,
        changeSetId: event.changeSetId,
        action: event.action,
      });
    } else if (event.type === "change_set_rolled_back") {
      store.getState().canvasSurface?.rollbackChangeSet(event.changeSetId);
    } else if (event.type === "change_set_committed") {
      store.getState().canvasSurface?.commitChangeSet({
        changeSetId: event.changeSetId,
        previousVersion: event.previousVersion,
        newVersion: event.newVersion,
      });
    } else if (event.type === "navigation_requested") {
      await integration.navigator?.(event.pathname);
    } else if (event.type === "action_succeeded") {
      await integration.invalidator?.(event.result.resources);
    }

    if (
      event.type === "action_started" ||
      event.type === "action_succeeded" ||
      event.type === "action_failed"
    ) {
      await refreshActions(threadId);
    }

    if (
      event.type === "approval_required" ||
      event.type === "change_set_ready" ||
      event.type === "change_set_committed" ||
      event.type === "change_set_rolled_back"
    ) {
      await refreshThreadData(threadId);
    }
    if (event.type === "terminal") {
      const wasRunning = store.getState().isRunning;
      store.setState((state) => ({
        isRunning: false,
        streamingText: "",
        context: {
          ...state.context,
          activeRun: null,
          capturedAt: new Date().toISOString(),
        },
      }));
      await wait(250);
      await refreshThreadData(threadId);
      if (wasRunning && event.status === "completed") {
        void ResultAsync.fromPromise(pollForFollowUp(threadId, envelope.runId), toError).match(
          () => undefined,
          (error) => store.setState({ error: error.message }),
        );
      }
    }
  };

  const startEventStream = (threadId: string, runId: string) => {
    if (streamControllers.has(runId)) return;
    const controller = new AbortController();
    streamControllers.set(runId, controller);
    void ResultAsync.fromPromise(
      client.consumeEvents(runId, {
        after: lastSequences.get(runId) ?? 0,
        signal: controller.signal,
        onEnvelope: (envelope) => processEnvelope(threadId, envelope),
      }),
      toError,
    ).match(
      () => {
        streamControllers.delete(runId);
      },
      async (error) => {
        streamControllers.delete(runId);
        if (controller.signal.aborted || store.getState().activeThreadId !== threadId) return;
        store.setState({ error: `Agent event stream disconnected: ${error.message}` });
        await wait(1_000);
        startEventStream(threadId, runId);
      },
    );
  };

  const loadThread = async (threadId: string) => {
    for (const controller of streamControllers.values()) controller.abort();
    streamControllers.clear();
    lastSequences.clear();
    store.setState({
      activeThreadId: threadId,
      messages: [],
      events: [],
      agUiEvents: [],
      actions: [],
      changeSets: [],
      approvals: [],
      streamingText: "",
      error: null,
    });
    await refreshThreadData(threadId);
    const latest = await client.getLatestRun(threadId);
    if (!latest) return;
    const terminal = ["completed", "failed", "cancelled", "timed_out", "interrupted"].includes(
      latest.status,
    );
    store.setState((state) => ({
      currentRunId: latest.id,
      isRunning: !terminal,
      error:
        latest.status === "failed" ||
        latest.status === "timed_out" ||
        latest.status === "interrupted"
          ? (latest.errorMessage ?? `Agent run ended with status ${latest.status}.`)
          : null,
      context: {
        ...state.context,
        activeRun: terminal ? null : { runId: latest.id, status: latest.status },
        capturedAt: new Date().toISOString(),
      },
    }));
    startEventStream(threadId, latest.id);
  };

  const runChangeSetOperation = async (
    operation: Promise<ChangeSetOperation>,
  ): Promise<{ snapshot: PipelineGraphSnapshot; newVersion: number }> => {
    const result = await operation;
    if (result.type !== "applied") {
      const detail =
        result.type === "version_conflict"
          ? `Pipeline version conflict (actual ${result.actualVersion ?? "missing"})`
          : result.type === "invalid_state"
            ? `Change Set is ${result.status}`
            : result.type === "history_diverged"
              ? "Pipeline history diverged; automatic rebase is disabled"
              : "Change Set was not found";
      throw new Error(detail);
    }
    const snapshot = result.changeSet.draftSnapshot;
    if (!snapshot) throw new Error("Server Change Set did not return its committed snapshot");

    return { snapshot, newVersion: result.newVersion };
  };

  store = createStore<AgentControlState>((set, get) => ({
    capabilities: null,
    threads: [],
    activeThreadId: null,
    messages: [],
    events: [],
    agUiEvents: [],
    actions: [],
    changeSets: [],
    approvals: [],
    context: emptyContext(),
    removedContextChips: [],
    executionChoice: null,
    selectedRuntimeId: null,
    currentRunId: null,
    streamingText: "",
    draft: "",
    isBootstrapping: false,
    isRunning: false,
    isDrawerOpen: false,
    error: null,
    canvasSurface: null,
    isCanvasSurfaceOpen: false,

    bootstrap: async () => {
      if (get().isBootstrapping || get().capabilities) return;
      set({ isBootstrapping: true, error: null });
      await ResultAsync.fromPromise(client.getCapabilities(), toError).match(
        async (capabilities) => {
          if (!capabilities.enabled) {
            set({ capabilities, isBootstrapping: false });

            return;
          }
          const threads = await client.listThreads();
          const activeThread = threads.find((thread) => thread.status === "active") ?? null;
          const selectedRuntime = capabilities.runtimes.find((runtime) => runtime.supported);
          const selectedRuntimeId = selectedRuntime?.runtimeConfigId ?? null;
          const executionChoice = selectedRuntime
            ? {
                runtimeConfigId: selectedRuntime.runtimeConfigId,
                ...(selectedRuntime.controlModel ? { model: selectedRuntime.controlModel } : {}),
                ...(selectedRuntime.controlReasoningEffort
                  ? { reasoningEffort: selectedRuntime.controlReasoningEffort }
                  : {}),
              }
            : null;
          set({
            capabilities,
            executionChoice,
            threads,
            selectedRuntimeId,
            isBootstrapping: false,
          });
          if (activeThread) await loadThread(activeThread.id);
        },
        (error) => set({ error: error.message, isBootstrapping: false }),
      );
    },

    selectThread: async (threadId) => loadThread(threadId),
    setDraft: (draft) => set({ draft }),
    setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
    setExecutionChoice: (executionChoice) =>
      set({ executionChoice, selectedRuntimeId: executionChoice.runtimeConfigId }),
    setSelectedRuntimeId: (selectedRuntimeId) =>
      set((state) => ({
        executionChoice: state.executionChoice
          ? { ...state.executionChoice, runtimeConfigId: selectedRuntimeId }
          : { runtimeConfigId: selectedRuntimeId },
        selectedRuntimeId,
      })),
    updateContext: (patch) =>
      set((state) => ({
        context: {
          ...state.context,
          ...patch,
          route: patch.route ?? state.context.route,
          selectedResources: patch.selectedResources ?? state.context.selectedResources,
          selectedNodeIds: patch.selectedNodeIds ?? state.context.selectedNodeIds,
          attachments: patch.attachments ?? state.context.attachments,
          activeRun: Object.prototype.hasOwnProperty.call(patch, "activeRun")
            ? (patch.activeRun ?? null)
            : state.context.activeRun,
          capturedAt: new Date().toISOString(),
        },
      })),
    removeContextChip: (key) =>
      set((state) => ({
        removedContextChips: state.removedContextChips.includes(key)
          ? state.removedContextChips
          : [...state.removedContextChips, key],
      })),
    restoreContextChips: () => set({ removedContextChips: [] }),
    registerCanvasSurface: (canvasSurface) => {
      set({
        canvasSurface,
        isCanvasSurfaceOpen: canvasSurface?.isOpen ?? false,
      });
      if (canvasSurface) hydrateCanvas();
    },
    setCanvasSurfaceOpen: (isCanvasSurfaceOpen) => set({ isCanvasSurfaceOpen }),
    registerInvalidator: (invalidator) => {
      integration.invalidator = invalidator;
    },
    registerNavigator: (navigate) => {
      integration.navigator = navigate;
    },
    openPreferredSurface: () => {
      const surface = get().canvasSurface;
      if (surface) {
        surface.openPanel();

        return;
      }
      set({ isDrawerOpen: true });
    },

    submit: async () => {
      const state = get();
      const message = state.draft.trim();
      if (!message || state.isRunning) return;
      if (!state.capabilities?.enabled) {
        set({ error: "ORDINE Agent Control is disabled." });

        return;
      }
      const executionChoice = state.executionChoice;
      if (!executionChoice) {
        set({ error: "No runtime has passed the MCP-only control mode verification." });

        return;
      }
      const context = filterContext(state.context, new Set(state.removedContextChips));
      set({ draft: "", error: null, streamingText: "", isRunning: true });
      await ResultAsync.fromPromise(
        (async () => {
          const thread = state.activeThreadId
            ? (state.threads.find((entry) => entry.id === state.activeThreadId) ?? null)
            : null;
          const activeThread = thread ?? (await client.createThread(context, message.slice(0, 80)));
          if (!thread) {
            set((current) => ({
              threads: [activeThread, ...current.threads],
              activeThreadId: activeThread.id,
            }));
          }
          await client.updateThreadContext(activeThread.id, context);
          set((current) => ({
            messages: [
              ...current.messages,
              {
                id: `optimistic-${crypto.randomUUID()}`,
                sessionId: activeThread.id,
                role: "user",
                kind: "text",
                content: message,
                context,
                runId: null,
                createdAt: new Date().toISOString(),
              },
            ],
            removedContextChips: [],
          }));
          const started = await client.startRun(activeThread.id, {
            message,
            context,
            runtimeId: executionChoice.runtimeConfigId,
            ...(executionChoice.model ? { model: executionChoice.model } : {}),
            ...(executionChoice.reasoningEffort
              ? { reasoningEffort: executionChoice.reasoningEffort }
              : {}),
            ...(executionChoice.speed ? { speed: executionChoice.speed } : {}),
            ...(executionChoice.firstOutputTimeoutSeconds === undefined
              ? {}
              : { firstOutputTimeoutSeconds: executionChoice.firstOutputTimeoutSeconds }),
          });
          set((current) => ({
            currentRunId: started.runId,
            context: {
              ...current.context,
              activeRun: { runId: started.runId, status: "running" },
              capturedAt: new Date().toISOString(),
            },
          }));
          startEventStream(activeThread.id, started.runId);
        })(),
        toError,
      ).match(
        () => undefined,
        (error) =>
          set((current) => ({
            error: error.message,
            isRunning: false,
            context: {
              ...current.context,
              activeRun: null,
              capturedAt: new Date().toISOString(),
            },
          })),
      );
    },

    stop: async () => {
      const runId = get().currentRunId;
      if (!runId) return;
      await ResultAsync.fromPromise(client.cancelRun(runId), toError).match(
        () =>
          set((state) => ({
            isRunning: false,
            context: {
              ...state.context,
              activeRun: null,
              capturedAt: new Date().toISOString(),
            },
          })),
        (error) => set({ error: error.message }),
      );
    },

    approve: async (approvalId) => {
      const threadId = get().activeThreadId;
      if (!threadId) return;
      await ResultAsync.fromPromise(client.approve(threadId, approvalId), toError).match(
        async (result) => {
          if (result.resumedRunId) {
            set((state) => ({
              currentRunId: result.resumedRunId,
              isRunning: true,
              context: {
                ...state.context,
                activeRun: { runId: result.resumedRunId!, status: "running" },
                capturedAt: new Date().toISOString(),
              },
            }));
            startEventStream(threadId, result.resumedRunId);
          }
          if (result.resumeError) set({ error: result.resumeError });
          await refreshThreadData(threadId);
        },
        (error) => set({ error: error.message }),
      );
    },
    rejectApproval: async (approvalId) => {
      const threadId = get().activeThreadId;
      if (!threadId) return;
      await ResultAsync.fromPromise(client.rejectApproval(threadId, approvalId), toError).match(
        async () => refreshThreadData(threadId),
        (error) => set({ error: error.message }),
      );
    },
    applyChangeSet: async (changeSetId, expectedVersion) => {
      const threadId = get().activeThreadId;
      if (!threadId) return;
      await ResultAsync.fromPromise(
        client.applyChangeSet(threadId, changeSetId, expectedVersion),
        toError,
      ).match(
        async (result) => {
          if (result.type !== "applied") {
            set({
              error:
                result.type === "version_conflict"
                  ? `Version conflict: Pipeline is ${result.actualVersion ?? "missing"}; the draft was preserved.`
                  : `Change Set cannot be applied (${result.type}).`,
            });

            return;
          }
          get().canvasSurface?.commitChangeSet({
            changeSetId,
            previousVersion: result.previousVersion,
            newVersion: result.newVersion,
          });
          await refreshThreadData(threadId);
        },
        (error) => set({ error: error.message }),
      );
    },
    rejectChangeSet: async (changeSetId) => {
      const threadId = get().activeThreadId;
      if (!threadId) return;
      await ResultAsync.fromPromise(client.rejectChangeSet(threadId, changeSetId), toError).match(
        async () => {
          get().canvasSurface?.rollbackChangeSet(changeSetId);
          await refreshThreadData(threadId);
        },
        (error) => set({ error: error.message }),
      );
    },
    revertChangeSet: async (changeSetId, expectedVersion) => {
      const threadId = get().activeThreadId;
      if (!threadId) throw new Error("No active Agent thread");
      const result = await runChangeSetOperation(
        client.revertChangeSet(threadId, changeSetId, expectedVersion),
      );
      await refreshThreadData(threadId);

      return result;
    },
    redoChangeSet: async (changeSetId, expectedVersion) => {
      const threadId = get().activeThreadId;
      if (!threadId) throw new Error("No active Agent thread");
      const result = await runChangeSetOperation(
        client.redoChangeSet(threadId, changeSetId, expectedVersion),
      );
      await refreshThreadData(threadId);

      return result;
    },
  }));

  return store;
};
