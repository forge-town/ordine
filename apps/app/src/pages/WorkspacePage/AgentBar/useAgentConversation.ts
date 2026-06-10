import { useCallback, useMemo, useState } from "react";
import { useUpdate } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useStore } from "zustand";
import type {
  ConversationMessageMetadata,
  PipelineAction,
  PipelineActionDiagnostic,
  PipelineActionProposal,
  WorkspacePhase,
} from "@repo/schemas";
import { ResourceName, dataProvider } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore } from "@/pages/CanvasPage/_store";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { useAgentConversationPersistence } from "./useAgentConversationPersistence";

export type AgentConversationSubmitInput = {
  content: string;
  metadata: ConversationMessageMetadata;
};

type ProposeActionsResult = {
  diagnostics?: PipelineActionDiagnostic[] | null;
  proposal?: PipelineActionProposal | null;
  reply?: string | null;
};

const actionTitle = (action: PipelineAction): string => {
  switch (action.type) {
    case "addNode": {
      return `Add ${action.node.type}`;
    }
    case "removeNode": {
      return "Remove node";
    }
    case "addEdge": {
      return "Add edge";
    }
    case "removeEdge": {
      return "Remove edge";
    }
    case "reconnectEdge": {
      return "Reconnect edge";
    }
    case "replaceNodeData": {
      return "Update node";
    }
    default: {
      return (action as { type: string }).type;
    }
  }
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
}: {
  phase: WorkspacePhase;
  pipelineId: string | null;
}) => {
  const canvasStore = useCanvasPageStore();
  const nodes = useStore(canvasStore, (state) => state.nodes);
  const edges = useStore(canvasStore, (state) => state.edges);
  const pipelineName = useStore(canvasStore, (state) => state.pipelineName);
  const setPendingProposal = useStore(canvasStore, (state) => state.setPendingProposal);
  const clearPendingProposal = useStore(canvasStore, (state) => state.clearPendingProposal);
  const applyAgentProposal = useStore(canvasStore, (state) => state.applyAgentProposal);
  const pendingProposal = useStore(canvasStore, (state) => state.agentPanel.pendingProposal);
  const diagnostics = useStore(canvasStore, (state) => state.agentPanel.diagnostics);
  const setPhase = useWorkspaceStore((state) => state.setPhase);
  const { mutateAsync: updatePipeline, mutation: updateMutation } = useUpdate();
  const [isProposing, setIsProposing] = useState(false);
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
        title: actionTitle(action),
      })) ?? [],
    [pendingProposal],
  );

  const submitMessage = useCallback(
    async ({ content, metadata }: AgentConversationSubmitInput) => {
      const trimmedContent = content.trim();
      if (!pipelineId || trimmedContent.length === 0) {
        return;
      }

      clearPendingProposal();
      setPhase("clarify");
      await sendMessage({ content: trimmedContent, metadata, role: "user" });
      setIsProposing(true);

      const result = await ResultAsync.fromPromise(
        dataProvider.custom!<ProposeActionsResult>({
          method: "post",
          payload: {
            id: pipelineId,
            attachments: metadata.attachments ?? [],
            message: trimmedContent,
            pipelineName,
            snapshot: { edges, nodes },
          },
          url: "pipelines/proposeActions",
        }),
        () => null,
      );

      if (result.isErr()) {
        setIsProposing(false);
        await sendMessage({
          content: "I could not draft a pipeline proposal from that message.",
          role: "assistant",
        });

        return;
      }

      const proposal = result.value.data.proposal ?? null;
      const nextDiagnostics = result.value.data.diagnostics ?? null;
      const reply =
        result.value.data.reply ??
        (proposal ? "I drafted a pipeline proposal." : "I could not find a safe graph change.");

      setPendingProposal(proposal, nextDiagnostics);
      if (proposal) {
        setPhase("proposal");
      }

      await sendMessage({
        content: reply,
        metadata: proposal ? { proposalSnapshot: createProposalSnapshot(proposal) } : undefined,
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
    ],
  );

  const applyProposal = useCallback(async () => {
    if (!pendingProposal || !pipelineId || hasBlockingDiagnostics) {
      return;
    }

    const applied = applyAgentProposal(pendingProposal);
    if (!applied) {
      return;
    }

    const nextCanvas = canvasStore.getState();
    const saved = await ResultAsync.fromPromise(
      updatePipeline({
        errorNotification: false,
        id: pipelineId,
        resource: ResourceName.pipelines,
        successNotification: false,
        values: {
          edges: nextCanvas.edges,
          name: nextCanvas.pipelineName || pipelineName,
          nodes: nextCanvas.nodes,
        },
      }),
      () => null,
    );

    if (saved.isErr()) {
      await sendMessage({
        content: "I applied the proposal locally, but could not save it yet.",
        role: "assistant",
      });

      return;
    }

    setPhase("applied");
    await sendMessage({
      content: "Applied the proposal and saved the pipeline.",
      metadata: { proposalSnapshot: createProposalSnapshot(pendingProposal) },
      role: "assistant",
    });
  }, [
    applyAgentProposal,
    canvasStore,
    hasBlockingDiagnostics,
    pendingProposal,
    pipelineId,
    pipelineName,
    sendMessage,
    setPhase,
    updatePipeline,
  ]);

  const rejectProposal = useCallback(async () => {
    clearPendingProposal();
    setPhase("clarify");
    await sendMessage({
      content: "Rejected the current proposal.",
      role: "assistant",
    });
  }, [clearPendingProposal, sendMessage, setPhase]);

  const reviseProposal = useCallback(async () => {
    clearPendingProposal();
    setPhase("clarify");
    await sendMessage({
      content: "Tell me what to revise and I will draft a new proposal.",
      role: "assistant",
    });
  }, [clearPendingProposal, sendMessage, setPhase]);

  return {
    applyProposal,
    diagnostics,
    hasBlockingDiagnostics,
    isSending: isPersisting || isProposing || updateMutation.isPending,
    pendingProposal,
    proposalItems,
    rejectProposal,
    reviseProposal,
    submitMessage,
  };
};
