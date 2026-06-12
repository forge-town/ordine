import type { AgentContextPayload, WorkspaceCanvasRef } from "@repo/schemas";

/** 与服务端对话历史窗口约定一致（N11-02：最近 20 条）。 */
export const HISTORY_WINDOW_LIMIT = 20;

export type BuildAgentContextJob = {
  id: string;
  status: string;
};

export type BuildAgentContextInput = {
  /** 运行中的 job（canvasStore.activeJob）。 */
  activeJob: BuildAgentContextJob | null;
  /** refId → 未解决锚点数（workspaceStore.anchorCounts）。 */
  anchorCounts: Record<string, number>;
  canvasRefs: WorkspaceCanvasRef[];
  dismissed: string[];
  hasConversation: boolean;
  /** 最近一个 job——失败后的提问也需要运行上下文（N12-03）。 */
  latestJob: BuildAgentContextJob | null;
  nodeRunStatuses: Record<string, string>;
  pipelineId: string | null;
  pipelineName?: string;
  /** refId → 画布标签，用于锚点项的可读名。 */
  refLabelById?: Record<string, string>;
};

/**
 * 上下文组装的单一事实源（手册 v3 决策 3 / N12-01）。
 * ContextStrip 渲染该函数输出，submitMessage 发送同一输出；
 * 两边不允许各自再编一套"上下文构成"。纯函数，便于快照单测。
 */
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
    // memory 留缺省：跨会话记忆未实现前不点亮、不发送（手册决策 5）。
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
