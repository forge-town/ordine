import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import type { AgentContextPayload } from "@repo/schemas";
import { useCanvasStore } from "../../canvas/_store/canvasStore";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { useAgentBarStore } from "../_store";
import { buildAgentContext } from "./buildAgentContext";

export type UseAgentContextInput = {
  pipelineId: string | null;
  pipelineName?: string;
};

/**
 * Hook 形态的 buildAgentContext：从三个 store 取真实状态并 memo。
 * AgentBar 把同一个返回值同时交给 ContextStrip（展示）与 submitMessage（发送）。
 */
export const useAgentContext = ({
  pipelineId,
  pipelineName,
}: UseAgentContextInput): AgentContextPayload => {
  const canvasRefs = useWorkspaceStore((state) => state.canvasRefs);
  const dismissed = useWorkspaceStore((state) => state.dismissed);
  const anchorCounts = useWorkspaceStore((state) => state.anchorCounts);
  const hasConversation = useAgentBarStore((state) => state.messages.length > 0);
  const activeJob = useCanvasStore(
    useShallow((state) =>
      state.activeJob ? { id: state.activeJob.id, status: state.activeJob.status } : null,
    ),
  );
  const latestJob = useCanvasStore(
    useShallow((state) =>
      state.latestJob ? { id: state.latestJob.id, status: state.latestJob.status } : null,
    ),
  );
  const nodeRunStatuses = useCanvasStore((state) => state.nodeRunStatuses);
  const refLabelById = useCanvasStore(
    useShallow((state) =>
      Object.fromEntries(state.nodes.map((node) => [node.id, node.data.label ?? node.id])),
    ),
  );

  return useMemo(
    () =>
      buildAgentContext({
        activeJob,
        anchorCounts,
        canvasRefs,
        dismissed,
        hasConversation,
        latestJob,
        nodeRunStatuses,
        pipelineId,
        pipelineName,
        refLabelById,
      }),
    [
      activeJob,
      anchorCounts,
      canvasRefs,
      dismissed,
      hasConversation,
      latestJob,
      nodeRunStatuses,
      pipelineId,
      pipelineName,
      refLabelById,
    ],
  );
};
