import type { TFunction } from "i18next";
import type {
  PipelineAction,
  PipelineActionProposal,
  ProposeActionsResponse,
  ProposePendingOperation,
} from "@repo/schemas";

/**
 * useAgentConversation 的纯展示/文案助手（H2-01 抽出，便于单测）。
 * 不含任何 React 状态或副作用——仅把提案/响应映射成 UI 文案。
 */

const ACTION_TITLE_KEYS: Record<PipelineAction["type"], string> = {
  addNode: "workspace.agentBar.actionTitles.addNode",
  removeNode: "workspace.agentBar.actionTitles.removeNode",
  addEdge: "workspace.agentBar.actionTitles.addEdge",
  removeEdge: "workspace.agentBar.actionTitles.removeEdge",
  reconnectEdge: "workspace.agentBar.actionTitles.reconnectEdge",
  replaceNodeData: "workspace.agentBar.actionTitles.replaceNodeData",
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

export type ProposalItem = { badge?: string; detail: string; title: string };

/** 把待定提案 + 草拟算子映射为 ProposalCard 列表项。 */
export const buildProposalItems = (
  pendingProposal: PipelineActionProposal | null | undefined,
  pendingOperations: ProposePendingOperation[],
  t: TFunction,
): ProposalItem[] => {
  const draftedOperationIds = new Set(pendingOperations.map((operation) => operation.id));

  return (
    pendingProposal?.actions.map((action) => ({
      badge:
        action.type === "addNode" &&
        "operationId" in action.node.data &&
        typeof action.node.data.operationId === "string" &&
        draftedOperationIds.has(action.node.data.operationId)
          ? t("workspace.agentBar.proposal.newOperationBadge")
          : undefined,
      detail: actionDetail(action),
      title: t(ACTION_TITLE_KEYS[action.type] ?? action.type, {
        nodeType: action.type === "addNode" ? action.node.type : undefined,
      }),
    })) ?? []
  );
};

/** 由 proposeActions 响应推导 assistant 回复文案（error / reply / 兜底三态）。 */
export const buildProposeReply = ({
  proposeError,
  baseReply,
  proposal,
  t,
}: {
  proposeError: NonNullable<ProposeActionsResponse["error"]> | null;
  baseReply: string | null | undefined;
  proposal: PipelineActionProposal | null;
  t: TFunction;
}): string => {
  if (proposeError) {
    return baseReply
      ? `${baseReply}\n${t("workspace.agentBar.errors.proposalDropped")}`
      : t(`workspace.agentBar.errors.${proposeError.code}`);
  }

  return (
    baseReply ??
    (proposal
      ? t("workspace.agentBar.replies.drafted")
      : t("workspace.agentBar.replies.noSafeChange"))
  );
};
