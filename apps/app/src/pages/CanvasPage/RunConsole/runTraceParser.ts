type TraceInput = {
  createdAt?: Date | string;
  id?: number;
  message: string;
};

export type RunTimelineStatus = "running" | "done" | "failed";

export type RunTimelineItem = {
  nodeId: string;
  status: RunTimelineStatus;
};

export type RunArtifact = {
  path: string;
};

export type RunTimelineResult = {
  artifacts: RunArtifact[];
  currentNodeId: string | null;
  latestProgressMessage: string;
  timeline: RunTimelineItem[];
};

type EdgeInput = {
  source: string;
  target: string;
};

const getValidTime = (value: Date | string | undefined): number | null => {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
};

const getMessageTimestamp = (message: string): number | null => {
  const match = /^\[([^\]]+)\]/.exec(message);

  return getValidTime(match?.[1]);
};

const sortTracesChronologically = (traces: TraceInput[]): TraceInput[] =>
  traces
    .map((trace, index) => ({
      index,
      order: getValidTime(trace.createdAt) ?? getMessageTimestamp(trace.message),
      trace,
    }))
    .sort((a, b) => {
      if (a.order === null && b.order === null) return a.index - b.index;
      if (a.order === null) return a.index - b.index;
      if (b.order === null) return a.index - b.index;
      if (a.order === b.order) return (a.trace.id ?? a.index) - (b.trace.id ?? b.index);

      return a.order - b.order;
    })
    .map(({ trace }) => trace);

const stripTimestamp = (message: string): string => {
  const match = /^\[([^\]]+)\]\s*/.exec(message);
  if (!match || getValidTime(match[1]) === null) return message;

  return message.slice(match[0].length);
};

const upsertTimelineItem = (
  timeline: RunTimelineItem[],
  nodeId: string,
  status: RunTimelineStatus,
) => {
  const existing = timeline.find((item) => item.nodeId === nodeId);
  if (existing) {
    existing.status = status;

    return;
  }

  timeline.push({ nodeId, status });
};

const getLatestRunningNodeId = (timeline: RunTimelineItem[]): string | null => {
  return [...timeline].reverse().find((item) => item.status === "running")?.nodeId ?? null;
};

const parseNodeMarker = (message: string, marker: string): string | null =>
  message.startsWith(marker) ? message.slice(marker.length) : null;

const parseOutputArtifactPath = (message: string): string | null => {
  const match = /^Wrote output to:\s+(.+?)\s+\(\d+\s+chars\)/.exec(message);

  return match?.[1] ?? null;
};

export const buildRunTimeline = (traces: TraceInput[]): RunTimelineResult => {
  const result: RunTimelineResult = {
    artifacts: [],
    currentNodeId: null,
    latestProgressMessage: "",
    timeline: [],
  };

  for (const trace of sortTracesChronologically(traces)) {
    const message = stripTimestamp(trace.message);
    const nodeStart = parseNodeMarker(message, "@@NODE_START::");
    const nodeDone = parseNodeMarker(message, "@@NODE_DONE::");
    const nodeFail = parseNodeMarker(message, "@@NODE_FAIL::");
    const artifactPath = parseOutputArtifactPath(message);

    if (nodeStart) {
      upsertTimelineItem(result.timeline, nodeStart, "running");
      result.currentNodeId = nodeStart;
      continue;
    }

    if (nodeDone) {
      upsertTimelineItem(result.timeline, nodeDone, "done");
      result.currentNodeId = getLatestRunningNodeId(result.timeline);
      continue;
    }

    if (nodeFail) {
      upsertTimelineItem(result.timeline, nodeFail, "failed");
      result.currentNodeId = getLatestRunningNodeId(result.timeline);
      continue;
    }

    if (artifactPath) {
      result.artifacts.push({ path: artifactPath });
      continue;
    }

    if (!message.startsWith("@@") && message.trim().length > 0) {
      result.latestProgressMessage = message;
    }
  }

  return result;
};

export const summarizeMultiInputNodes = (edges: EdgeInput[]) => {
  const parentCounts = new Map<string, number>();
  for (const edge of edges) {
    parentCounts.set(edge.target, (parentCounts.get(edge.target) ?? 0) + 1);
  }

  const nodeIds = [...parentCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([nodeId]) => nodeId);

  return {
    count: nodeIds.length,
    nodeIds,
  };
};
