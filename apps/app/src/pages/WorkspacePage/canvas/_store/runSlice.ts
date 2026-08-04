import type { StateCreator } from "zustand";
import {
  normalizeNodeRunStatus,
  type Job,
  type JobTrace,
  type NodeArtifact,
  type NodeRunStatus,
} from "@repo/schemas";

type RawNodeRunStatuses = Record<string, NodeRunStatus | string>;

export type CheckpointWaitState = {
  jobId: string;
  nodeId: string;
};

export type RunSlice = {
  activeJob: Job | null;
  activeJobId: string | null;
  checkpointWait: CheckpointWaitState | null;
  latestJob: Job | null;
  nodeArtifacts: Record<string, NodeArtifact>;
  nodeLlmContent: Record<string, string>;
  nodeRunStatuses: Record<string, NodeRunStatus>;
  runTraces: JobTrace[];
  runningNodeId: string | null;
  applyJobSnapshot: (job: Job | null) => void;
  applyNodeArtifact: (nodeId: string, artifact: NodeArtifact) => void;
  applyNodeLlmContent: (nodeId: string, content: string) => void;
  beginRun: (jobId: string) => void;
  clearRunState: () => void;
  markNodeFailed: (nodeId: string) => void;
  markNodeRunning: (nodeId: string) => void;
  markNodeSkipped: (nodeId: string) => void;
  markNodeSucceeded: (nodeId: string) => void;
  setNodeRunStatuses: (statuses: RawNodeRunStatuses) => void;
  setRunTraces: (traces: JobTrace[]) => void;
};

const LIVE_JOB_STATUSES = new Set<Job["status"]>(["paused", "queued", "running"]);
const ACTIVE_NODE_STATUSES = new Set<NodeRunStatus>(["queued", "running", "retrying"]);

const normalizeNodeRunStatuses = (
  statuses: RawNodeRunStatuses | null | undefined,
): Record<string, NodeRunStatus> =>
  Object.fromEntries(
    Object.entries(statuses ?? {}).map(([nodeId, status]) => [
      nodeId,
      normalizeNodeRunStatus(status),
    ]),
  );

const getActiveRunNodeId = (statuses: Record<string, NodeRunStatus>): string | null =>
  Object.entries(statuses).find(([, status]) => ACTIVE_NODE_STATUSES.has(status))?.[0] ?? null;

const getCheckpointWait = (
  activeJobId: string | null,
  statuses: Record<string, NodeRunStatus>,
): CheckpointWaitState | null => {
  const nodeId =
    Object.entries(statuses).find(([, status]) => status === "waitingForUser")?.[0] ?? null;

  return activeJobId && nodeId ? { jobId: activeJobId, nodeId } : null;
};

export const createRunSlice =
  <T extends RunSlice>(): StateCreator<T, [], [], RunSlice> =>
  (set, get) => ({
    activeJob: null,
    activeJobId: null,
    checkpointWait: null,
    latestJob: null,
    nodeArtifacts: {},
    nodeLlmContent: {},
    nodeRunStatuses: {},
    runTraces: [],
    runningNodeId: null,
    applyJobSnapshot: (job) => {
      if (!job) {
        return;
      }

      const statuses = normalizeNodeRunStatuses(job.nodeStatuses);
      const activeJobId = LIVE_JOB_STATUSES.has(job.status) ? job.id : null;

      set({
        activeJob: activeJobId ? job : null,
        activeJobId,
        checkpointWait: getCheckpointWait(activeJobId, statuses),
        latestJob: job,
        nodeRunStatuses: statuses,
        runningNodeId: getActiveRunNodeId(statuses),
      } as unknown as Partial<T>);
    },
    beginRun: (jobId) =>
      set({
        activeJobId: jobId,
        checkpointWait: null,
        nodeArtifacts: {},
        nodeLlmContent: {},
        nodeRunStatuses: {},
        runTraces: [],
        runningNodeId: null,
      } as unknown as Partial<T>),
    applyNodeArtifact: (nodeId, artifact) =>
      set(
        (state) =>
          ({
            nodeArtifacts: { ...state.nodeArtifacts, [nodeId]: artifact },
          }) as unknown as Partial<T>,
      ),
    applyNodeLlmContent: (nodeId, content) =>
      set(
        (state) =>
          ({
            nodeLlmContent: { ...state.nodeLlmContent, [nodeId]: content },
          }) as unknown as Partial<T>,
      ),
    clearRunState: () =>
      set({
        activeJob: null,
        activeJobId: null,
        checkpointWait: null,
        nodeArtifacts: {},
        nodeLlmContent: {},
        nodeRunStatuses: {},
        runTraces: [],
        runningNodeId: null,
      } as unknown as Partial<T>),
    markNodeFailed: (nodeId) =>
      get().setNodeRunStatuses({ ...get().nodeRunStatuses, [nodeId]: "failed" }),
    markNodeRunning: (nodeId) =>
      get().setNodeRunStatuses({ ...get().nodeRunStatuses, [nodeId]: "running" }),
    markNodeSkipped: (nodeId) =>
      get().setNodeRunStatuses({ ...get().nodeRunStatuses, [nodeId]: "skipped" }),
    markNodeSucceeded: (nodeId) =>
      get().setNodeRunStatuses({ ...get().nodeRunStatuses, [nodeId]: "done" }),
    setNodeRunStatuses: (statuses) => {
      const nodeRunStatuses = normalizeNodeRunStatuses(statuses);

      set(
        (state) =>
          ({
            checkpointWait: getCheckpointWait(state.activeJobId, nodeRunStatuses),
            nodeRunStatuses,
            runningNodeId: getActiveRunNodeId(nodeRunStatuses),
          }) as unknown as Partial<T>,
      );
    },
    setRunTraces: (traces) => set({ runTraces: [...traces] } as unknown as Partial<T>),
  });
