import type { JobStatus, WorkspacePhase } from "@repo/schemas";
import type { CanvasNode } from "./canvasTypes";

type PipelineJob = {
  status: JobStatus;
};

export type DerivePhaseInput = {
  activeJob?: PipelineJob | null;
  graphDirtySinceLatestJob?: boolean;
  latestJob?: PipelineJob | null;
  nodes: readonly CanvasNode[];
  pendingProposal?: unknown | null;
};

const ACTIVE_JOB_STATUSES = new Set<JobStatus>(["paused", "queued", "running"]);

export const derivePhase = ({
  activeJob,
  graphDirtySinceLatestJob = false,
  latestJob,
  nodes,
  pendingProposal,
}: DerivePhaseInput): WorkspacePhase => {
  if (pendingProposal) {
    return "proposal";
  }
  if (activeJob && ACTIVE_JOB_STATUSES.has(activeJob.status)) {
    return "running";
  }
  if (nodes.length === 0) {
    return "empty";
  }
  if (latestJob?.status === "done" && !graphDirtySinceLatestJob) {
    return "done";
  }

  return "applied";
};
