import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpcClient } from "@/integrations/trpc/client";
import { toastStore } from "@/store/toastStore";
import { useCanvasStore } from "../../_store/canvasStore";
import { DecisionBoardView } from "./DecisionBoardView";
import type { DecisionCandidate } from "./DecisionCandidateCard";

/**
 * 决策节点进入 waitingForUser 时弹出（与 CheckpointDialog 同属运行态挂起 UI，
 * 但靠节点 type==="decision" 区分；候选 = 上游入边源节点的产物内容）。
 */
export const DecisionBoard = () => {
  const { t } = useTranslation();
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const nodeRunStatuses = useCanvasStore((state) => state.nodeRunStatuses);
  const nodeLlmContent = useCanvasStore((state) => state.nodeLlmContent);
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const configNodeId = useCanvasStore((state) => state.configNodeId);
  const setNodeRunStatuses = useCanvasStore((state) => state.setNodeRunStatuses);
  const selections = useCanvasStore((state) => state.decisionSelections);
  const toggleDecisionCandidate = useCanvasStore((state) => state.toggleDecisionCandidate);
  const clearDecisionSelection = useCanvasStore((state) => state.clearDecisionSelection);
  const [submitting, setSubmitting] = useState(false);

  const decisionNode = nodes.find(
    (node) => node.type === "decision" && nodeRunStatuses[node.id] === "waitingForUser",
  );

  if (!decisionNode || !activeJobId || configNodeId === decisionNode.id) {
    return null;
  }

  const data = decisionNode.data;
  const selectMode = data.nodeType === "decision" ? data.selectMode : "single";
  const instruction = data.nodeType === "decision" ? data.instruction : undefined;
  const nodeId = decisionNode.id;

  const candidates: DecisionCandidate[] = edges
    .filter((edge) => edge.target === nodeId)
    .map((edge, index) => {
      const source = nodes.find((node) => node.id === edge.source);

      return {
        nodeId: edge.source,
        label: source?.data.label ?? t("workspace.canvas.decision.candidate", { index: index + 1 }),
        content: nodeLlmContent[edge.source] ?? "",
      };
    });

  const selectedIds = selections[nodeId] ?? [];

  const handleConfirm = () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    trpcClient.jobs.resolveDecision
      .mutate({ jobId: activeJobId, nodeId, selectedNodeIds: selectedIds })
      .then(() => {
        setNodeRunStatuses({ ...nodeRunStatuses, [nodeId]: "running" });
        clearDecisionSelection(nodeId);
        toastStore.getState().addToast({
          title: t("workspace.canvas.decision.resolved"),
          type: "success",
        });
      })
      .catch(() => {
        setSubmitting(false);
        toastStore
          .getState()
          .addToast({ title: t("workspace.canvas.decision.resolveFailed"), type: "error" });
      });
  };

  return (
    <DecisionBoardView
      nodeLabel={data.label ?? nodeId}
      instruction={instruction}
      selectMode={selectMode}
      candidates={candidates}
      selectedIds={selectedIds}
      submitting={submitting}
      onToggle={(candidateId) => toggleDecisionCandidate(nodeId, candidateId, selectMode)}
      onConfirm={handleConfirm}
    />
  );
};
