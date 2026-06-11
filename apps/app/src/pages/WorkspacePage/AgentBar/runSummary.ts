import type { Job, JobTrace, NodeRunStatus } from "@repo/schemas";

type SummaryNode = {
  data: { label?: string };
  id: string;
};

const ACTIVE_NODE_STATUSES = new Set<NodeRunStatus>(["running", "waitingForUser", "retrying"]);

const TERMINAL_NODE_STATUSES = new Set<NodeRunStatus>(["done", "failed", "skipped", "cancelled"]);

const toTime = (value: Date | string | number | null | undefined): number | null => {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
};

const formatDuration = (start: number | null, end: number | null): string | null => {
  if (start === null) return null;
  const seconds = Math.max(0, ((end ?? Date.now()) - start) / 1000);

  return `${seconds.toFixed(1)}s`;
};

const formatCost = (value: Job["totalCost"]): string | null => {
  const cost = typeof value === "string" ? Number(value) : value;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) return null;

  return `$${cost.toFixed(2)}`;
};

const getNodeLabel = (node: SummaryNode | undefined, fallback: string) =>
  node?.data.label ?? fallback;

export type AgentRunSummary = {
  costLabel?: string;
  failedError?: {
    title: string;
    what: string;
    why: string;
    tryLabel: string;
  };
  isLive: boolean;
  subtitle: string;
  title: string;
};

export type SelfHealRunStep = { label: string; tone?: "muted" | "success" };

export const buildSelfHealSteps = (traces: Pick<JobTrace, "message">[]): SelfHealRunStep[] =>
  traces
    .slice()
    .reverse()
    .flatMap<SelfHealRunStep>((trace) => {
      if (trace.message.startsWith("@@SELF_HEAL_DONE::")) {
        const [, nodeId, attempt] = trace.message.split("::");

        return [
          {
            label: `Node ${nodeId ?? "unknown"} recovered on retry ${attempt ?? "1"}`,
            tone: "success" as const,
          },
        ];
      }

      if (!trace.message.startsWith("@@SELF_HEAL::")) return [];

      const [, nodeId, attempt, detail] = trace.message.split("::");

      return [
        {
          label: `Retry ${attempt ?? "1"} for ${nodeId ?? "unknown"} - ${detail ?? "automatic recovery"}`,
          tone: "muted" as const,
        },
      ];
    });

export const buildAgentRunSummary = ({
  job,
  nodeStatuses,
  nodes,
  now = Date.now(),
}: {
  job: Job | null;
  nodeStatuses: Record<string, NodeRunStatus>;
  nodes: SummaryNode[];
  now?: number;
}): AgentRunSummary => {
  const statusCount = Object.keys(nodeStatuses).length;
  const totalSteps = nodes.length > 0 ? nodes.length : statusCount;
  const nodeEntries = nodes.map((node) => ({
    id: node.id,
    label: getNodeLabel(node, node.id),
    status: nodeStatuses[node.id],
  }));
  const activeEntry =
    nodeEntries.find((entry) => entry.status && ACTIVE_NODE_STATUSES.has(entry.status)) ??
    nodeEntries.find((entry) => entry.status === "failed") ??
    nodeEntries.find((entry) => entry.status === "queued");
  const activeIndex = activeEntry
    ? nodeEntries.findIndex((entry) => entry.id === activeEntry.id)
    : -1;
  const terminalCount = Object.values(nodeStatuses).filter((status) =>
    TERMINAL_NODE_STATUSES.has(status),
  ).length;
  const currentStep =
    activeIndex >= 0 ? activeIndex + 1 : totalSteps > 0 ? Math.min(terminalCount, totalSteps) : 0;
  const currentLabel = activeEntry?.label ?? (totalSteps > 0 ? "Finishing run" : "Waiting");
  const jobId = job?.id ?? "job";
  const isFailed = job?.status === "failed" || Object.values(nodeStatuses).includes("failed");
  const isDone = job?.status === "done";
  const titlePrefix = isFailed ? "Failed" : isDone ? "Completed" : "Running";
  const duration = formatDuration(
    toTime(job?.startedAt ?? job?.meta?.createdAt),
    isDone || isFailed ? toTime(job?.finishedAt) : now,
  );
  const cost = formatCost(job?.totalCost ?? null);
  const costLabel = [duration, cost].filter(Boolean).join(" - ") || undefined;
  const failedNode = nodeEntries.find((entry) => entry.status === "failed");
  const failedLabel = failedNode?.label ?? currentLabel;

  return {
    costLabel,
    failedError: isFailed
      ? {
          title: `Run failed - ${failedLabel}`,
          what: `The "${failedLabel}" step failed before the pipeline could finish.`,
          why:
            job?.error ??
            "The runner reported a failure. Check the trace for the exact command or agent output.",
          tryLabel: "Open the failed node, inspect its trace, then revise and run again.",
        }
      : undefined,
    isLive: !isDone && !isFailed,
    subtitle:
      totalSteps > 0
        ? `Step ${currentStep || 1} of ${totalSteps} - ${currentLabel}`
        : "Waiting for node status updates",
    title: `${titlePrefix} - ${jobId}`,
  };
};
