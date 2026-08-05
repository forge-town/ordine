import type { AgentContextPayload, WorkspaceCanvasRef } from "@repo/schemas";

export const HISTORY_WINDOW_LIMIT = 20;

export type BuildAgentContextJob = {
  id: string;
  status: string;
};

export type BuildAgentContextInput = {
  activeJob: BuildAgentContextJob | null;
  anchorCounts: Record<string, number>;
  canvasRefs: WorkspaceCanvasRef[];
  dismissed: string[];
  hasConversation: boolean;
  latestJob: BuildAgentContextJob | null;
  nodeRunStatuses: Record<string, string>;
  pipelineId: string | null;
  pipelineName?: string;
  refLabelById?: Record<string, string>;
};

export const buildAgentContext = (input: BuildAgentContextInput): AgentContextPayload => {
  const selection = input.canvasRefs
    .filter((ref) => !input.dismissed.includes(ref.id))
    .map((ref) => ({
      label: ref.label,
      refId: ref.id,
      type: ref.type === "edge" ? ("edge" as const) : ("node" as const),
    }));

  const anchors = Object.entries(input.anchorCounts)
    .filter(([, count]) => count > 0)
    .map(([refId, count]) => ({
      count,
      label: input.refLabelById?.[refId],
      refId,
    }));

  const relevantJob =
    input.activeJob ?? (input.latestJob?.status === "failed" ? input.latestJob : null);

  return {
    anchors,
    project: input.pipelineId
      ? { pipelineId: input.pipelineId, pipelineName: input.pipelineName }
      : undefined,
    runState: relevantJob
      ? {
          jobId: relevantJob.id,
          nodeStatuses: input.nodeRunStatuses,
          status: relevantJob.status,
        }
      : undefined,
    selection,
    snapshotIncluded: true,
    threadWindow: { enabled: input.hasConversation, limit: HISTORY_WINDOW_LIMIT },
  };
};
