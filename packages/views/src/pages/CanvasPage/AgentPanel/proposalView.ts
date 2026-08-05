import type { TFunction } from "i18next";
import type {
  PipelineAction,
  PipelineActionProposal,
  ProposePendingOperation,
} from "@repo/schemas";

/**
 * useAgentConversation 的纯展示/文案助手（H2-01 抽出，便于单测）。
 * 不含任何 React 状态或副作用——仅把提案/响应映射成 UI 文案。
 */

const ACTION_TITLE_KEYS: Record<PipelineAction["type"], string> = {
  addNode: "canvas.agentPanel.proposalDetails.actionTitles.addNode",
  removeNode: "canvas.agentPanel.proposalDetails.actionTitles.removeNode",
  addEdge: "canvas.agentPanel.proposalDetails.actionTitles.addEdge",
  removeEdge: "canvas.agentPanel.proposalDetails.actionTitles.removeEdge",
  reconnectEdge: "canvas.agentPanel.proposalDetails.actionTitles.reconnectEdge",
  replaceNodeData: "canvas.agentPanel.proposalDetails.actionTitles.replaceNodeData",
};

const actionDetail = (action: PipelineAction): string => {
  switch (action.type) {
    case "addNode": {
      return action.node.data.label ?? action.node.id;
    }
    case "removeNode": {
      return action.nodeId;
    }
    case "addEdge": {
      return `${action.edge.source} -> ${action.edge.target}`;
    }
    case "removeEdge": {
      return action.edgeId;
    }
    case "reconnectEdge": {
      return `${action.edgeId} -> ${action.source} / ${action.target}`;
    }
    case "replaceNodeData": {
      return action.nodeId;
    }
    default: {
      return "";
    }
  }
};

export const createProposalSnapshot = (proposal: PipelineActionProposal) => ({
  addedEdges: proposal.actions
    .filter(
      (action): action is Extract<PipelineAction, { type: "addEdge" }> => action.type === "addEdge",
    )
    .map((action) => action.edge.id),
  addedNodes: proposal.actions
    .filter(
      (action): action is Extract<PipelineAction, { type: "addNode" }> => action.type === "addNode",
    )
    .map((action) => action.node.id),
});

export type ProposalBadge = { label: string; tone?: "success" | "accent" };
export type ProposalItem = { badges: ProposalBadge[]; detail: string; title: string };

/**
 * 把待定提案 + 草拟算子映射为 ProposalCard 列表项。
 * 每个节点可带多枚徽标：new op（N16-01）+ loop ×N（N20-02，真实可执行的迭代环）。
 */
export const buildProposalItems = (
  pendingProposal: PipelineActionProposal | null | undefined,
  pendingOperations: ProposePendingOperation[],
  t: TFunction,
): ProposalItem[] => {
  const draftedOperationIds = new Set(pendingOperations.map((operation) => operation.id));

  return (
    pendingProposal?.actions.map((action) => {
      const badges: ProposalBadge[] = [];
      if (action.type === "addNode") {
        const data = action.node.data;
        if (
          "operationId" in data &&
          typeof data.operationId === "string" &&
          draftedOperationIds.has(data.operationId)
        ) {
          badges.push({ label: t("canvas.agentPanel.proposalDetails.newOperationBadge") });
        }
        if ("loopEnabled" in data && data.loopEnabled) {
          const count = "maxLoopCount" in data ? (data.maxLoopCount ?? 3) : 3;
          badges.push({
            label: t("canvas.agentPanel.proposalDetails.loopBadge", { count }),
            tone: "accent",
          });
        }
      }

      return {
        badges,
        detail: actionDetail(action),
        title: t(ACTION_TITLE_KEYS[action.type] ?? action.type, {
          nodeType: action.type === "addNode" ? action.node.type : undefined,
        }),
      };
    }) ?? []
  );
};
