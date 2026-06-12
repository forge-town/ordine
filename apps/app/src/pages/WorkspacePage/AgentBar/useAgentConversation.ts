import { useCallback, useContext, useMemo, useState } from "react";
import { useUpdate } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import type {
  ConversationMessageMetadata,
  PipelineAction,
  PipelineActionProposal,
  ProposeActionsResponse,
  ProposePendingOperation,
  WorkspacePhase,
} from "@repo/schemas";
import { ResourceName, dataProvider } from "@/integrations/refine/dataProvider";
import { CanvasStoreContext, useCanvasStore } from "../canvas/_store/canvasStore";
import { toPipelineSnapshot } from "../canvas/_store/canvasTypes";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { useAgentConversationPersistence } from "./useAgentConversationPersistence";

export type AgentConversationSubmitInput = {
  content: string;
  /** Full proposal that failed validation — sent to the agent for a fix round. */
  failedProposal?: PipelineActionProposal;
  metadata: ConversationMessageMetadata;
};

type ProposeActionsResult = Partial<ProposeActionsResponse>;

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

const createProposalSnapshot = (proposal: PipelineActionProposal) => ({
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

export const useAgentConversation = ({
  phase,
  pipelineId,
  pipelineName = "",
}: {
  phase: WorkspacePhase;
  pipelineId: string | null;
  pipelineName?: string;
}) => {
  const { t } = useTranslation();
  const canvasStore = useContext(CanvasStoreContext);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const setPendingProposal = useCanvasStore((state) => state.setPendingProposal);
  const clearPendingProposal = useCanvasStore((state) => state.clearPendingProposal);
  const applyAgentProposal = useCanvasStore((state) => state.applyProposal);
  const pendingProposal = useCanvasStore((state) => state.pendingProposal);
  const diagnostics = useCanvasStore((state) => state.proposalDiagnostics);
  const setPhase = useWorkspaceStore((state) => state.setPhase);
  const { mutateAsync: updatePipeline, mutation: updateMutation } = useUpdate();
  const [isProposing, setIsProposing] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<ProposePendingOperation[]>([]);
  const { isSending: isPersisting, sendMessage } = useAgentConversationPersistence({
    phase,
    pipelineId,
  });
  const hasBlockingDiagnostics =
    diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;
  const proposalItems = useMemo(
    () =>
      pendingProposal?.actions.map((action) => ({
        detail: actionDetail(action),
        title: t(ACTION_TITLE_KEYS[action.type] ?? action.type, {
          nodeType: action.type === "addNode" ? action.node.type : undefined,
        }),
      })) ?? [],
    [pendingProposal, t],
  );

  const submitMessage = useCallback(
    async ({ content, failedProposal, metadata }: AgentConversationSubmitInput) => {
      const trimmedContent = content.trim();
      if (!pipelineId || trimmedContent.length === 0) {
        return;
      }

      const reversing = (metadata.attachments?.length ?? 0) > 0;
      clearPendingProposal();
      setPhase(reversing ? "reversing" : "clarify");
      setIsReversing(reversing);
      await sendMessage({ content: trimmedContent, metadata, role: "user" });
      setIsProposing(true);

      const result = await ResultAsync.fromPromise(
        dataProvider.custom!<ProposeActionsResult>({
          method: "post",
          payload: {
            id: pipelineId,
            attachments: metadata.attachments ?? [],
            diagnostics: metadata.diagnostics ?? [],
            failedProposal,
            message: trimmedContent,
            pipelineName,
            referencedNodeIds: metadata.referencedNodeIds ?? [],
            snapshot: toPipelineSnapshot({ edges, nodes }),
          },
          url: "pipelines/proposeActions",
        }),
        () => null,
      );

      if (result.isErr()) {
        setIsProposing(false);
        setIsReversing(false);
        await sendMessage({
          content: t("workspace.agentBar.replies.requestFailed"),
          role: "assistant",
        });

        return;
      }

      const proposal = result.value.data.proposal ?? null;
      const nextDiagnostics = result.value.data.diagnostics ?? null;
      const clarifyOptions = result.value.data.clarifyOptions ?? [];
      const proposeError = result.value.data.error ?? null;
      const baseReply = result.value.data.reply;
      const reply = proposeError
        ? baseReply
          ? `${baseReply}\n${t("workspace.agentBar.errors.proposalDropped")}`
          : t(`workspace.agentBar.errors.${proposeError.code}`)
        : (baseReply ??
          (proposal
            ? t("workspace.agentBar.replies.drafted")
            : t("workspace.agentBar.replies.noSafeChange")));

      setPendingProposal(proposal, nextDiagnostics);
      setPendingOperations(proposal ? (result.value.data.pendingOperations ?? []) : []);
      setIsReversing(false);
      if (proposal) {
        setPhase("proposal");
      }

      await sendMessage({
        content: reply,
        metadata: proposal
          ? { proposalSnapshot: createProposalSnapshot(proposal) }
          : proposeError
            ? { proposeErrorCode: proposeError.code }
            : clarifyOptions.length > 0
              ? { clarifyOptions }
              : undefined,
        role: "assistant",
      });
      setIsProposing(false);
    },
    [
      clearPendingProposal,
      edges,
      nodes,
      pipelineId,
      pipelineName,
      sendMessage,
      setPendingProposal,
      setPhase,
      t,
    ],
  );

  const applyProposal = useCallback(async () => {
    if (!pendingProposal || !pipelineId || hasBlockingDiagnostics) {
      return;
    }

    // Agent-drafted operations must exist in the library before the graph
    // references them (PRD §7.3 资产沉淀).
    if (pendingOperations.length > 0) {
      const created = await ResultAsync.fromPromise(
        dataProvider.custom!({
          method: "post",
          payload: { operations: pendingOperations },
          url: "pipelines/createPendingOperations",
        }),
        () => null,
      );
      if (created.isErr()) {
        await sendMessage({
          content: t("workspace.agentBar.replies.appliedNotSaved"),
          role: "assistant",
        });

        return;
      }
      setPendingOperations([]);
    }

    const applied = applyAgentProposal(pendingProposal);
    if (!applied || !canvasStore) {
      return;
    }

    const nextCanvas = canvasStore.getState();
    const nextSnapshot = toPipelineSnapshot({
      edges: nextCanvas.edges,
      nodes: nextCanvas.nodes,
    });
    const saved = await ResultAsync.fromPromise(
      updatePipeline({
        errorNotification: false,
        id: pipelineId,
        resource: ResourceName.pipelines,
        successNotification: false,
        values: {
          edges: nextSnapshot.edges,
          nodes: nextSnapshot.nodes,
        },
      }),
      () => null,
    );

    if (saved.isErr()) {
      await sendMessage({
        content: t("workspace.agentBar.replies.appliedNotSaved"),
        role: "assistant",
      });

      return;
    }

    setPhase("applied");
    await sendMessage({
      content: t("workspace.agentBar.replies.appliedSaved"),
      metadata: { proposalSnapshot: createProposalSnapshot(pendingProposal) },
      role: "assistant",
    });
  }, [
    applyAgentProposal,
    canvasStore,
    hasBlockingDiagnostics,
    pendingOperations,
    pendingProposal,
    pipelineId,
    pipelineName,
    sendMessage,
    setPhase,
    t,
    updatePipeline,
  ]);

  const rejectProposal = useCallback(async () => {
    const rejectedSummary = pendingProposal?.summary;
    setPendingOperations([]);
    clearPendingProposal();
    setPhase("clarify");
    await sendMessage({
      content: rejectedSummary
        ? t("workspace.agentBar.replies.rejectedWithProposal", { summary: rejectedSummary })
        : t("workspace.agentBar.replies.rejected"),
      role: "assistant",
    });
  }, [clearPendingProposal, pendingProposal, sendMessage, setPhase, t]);

  const reviseProposal = useCallback(async () => {
    const revisedSummary = pendingProposal?.summary;
    setPendingOperations([]);
    clearPendingProposal();
    setPhase("clarify");
    await sendMessage({
      content: revisedSummary
        ? t("workspace.agentBar.replies.reviseHintWithProposal", { summary: revisedSummary })
        : t("workspace.agentBar.replies.reviseHint"),
      role: "assistant",
    });
  }, [clearPendingProposal, pendingProposal, sendMessage, setPhase, t]);

  const requestProposalFix = useCallback(async () => {
    if (!pendingProposal || !diagnostics || diagnostics.length === 0) {
      return;
    }

    const failedProposal = pendingProposal;
    const diagnosticMessages = diagnostics.map((diagnostic) => diagnostic.message);
    await submitMessage({
      content: t("workspace.agentBar.replies.fixRequest"),
      failedProposal,
      metadata: { diagnostics: diagnosticMessages, referencedNodeIds: [] },
    });
  }, [diagnostics, pendingProposal, submitMessage, t]);

  return {
    applyProposal,
    diagnostics,
    hasBlockingDiagnostics,
    isReversing,
    isSending: isPersisting || isProposing || updateMutation.isPending,
    pendingProposal,
    proposalItems,
    rejectProposal,
    requestProposalFix,
    reviseProposal,
    submitMessage,
  };
};
