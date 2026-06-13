import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUpdate } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import type {
  ConversationMessageMetadata,
  PipelineAction,
  PipelineActionProposal,
  ProposeActionsResponse,
  ProposeAttachment,
  ProposePendingOperation,
  WorkspacePhase,
} from "@repo/schemas";
import { ResourceName, dataProvider } from "@/integrations/refine/dataProvider";
import { CanvasStoreContext, useCanvasStore } from "../canvas/_store/canvasStore";
import { toPipelineSnapshot } from "../canvas/_store/canvasTypes";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { useAgentContext } from "./context";
import { useAgentConversationPersistence } from "./useAgentConversationPersistence";

export type AgentConversationSubmitInput = {
  content: string;
  /** Full proposal that failed validation — sent to the agent for a fix round. */
  failedProposal?: PipelineActionProposal;
  metadata: ConversationMessageMetadata;
  /** 附件全文（N14-01）：只进请求体，持久化走 metadata.attachments（excerpt）。 */
  proposeAttachments?: ProposeAttachment[];
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
  const agentContext = useAgentContext({ pipelineId, pipelineName });
  const { mutateAsync: updatePipeline, mutation: updateMutation } = useUpdate();
  const [isProposing, setIsProposing] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<ProposePendingOperation[]>([]);
  // N19-01：空画布建图时 Agent 给出的流水线名，Apply 时仅在仍为默认名时采用。
  const [suggestedPipelineName, setSuggestedPipelineName] = useState<string | null>(null);
  const [progressToken, setProgressToken] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);

  // N15-01：请求期间轮询服务端真实阶段（thinking → analyzing? → drafting → validating）。
  useEffect(() => {
    if (!progressToken) {
      return;
    }

    const intervalId = globalThis.setInterval(() => {
      void dataProvider.custom!<{ stage: string | null }>({
        method: "post",
        payload: { token: progressToken },
        url: "pipelines/proposeProgress",
      })
        .then((response) => {
          if (response.data.stage) {
            setProgressStage(response.data.stage);
          }
        })
        .catch(() => undefined);
    }, 700);

    return () => globalThis.clearInterval(intervalId);
  }, [progressToken]);
  const { isSending: isPersisting, sendMessage } = useAgentConversationPersistence({
    phase,
    pipelineId,
  });
  const hasBlockingDiagnostics =
    diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;
  const proposalItems = useMemo(() => {
    const draftedOperationIds = new Set(pendingOperations.map((operation) => operation.id));

    return (
      pendingProposal?.actions.map((action) => {
        const badges: { label: string; tone?: "success" | "accent" }[] = [];
        if (action.type === "addNode") {
          const data = action.node.data;
          if (
            "operationId" in data &&
            typeof data.operationId === "string" &&
            draftedOperationIds.has(data.operationId)
          ) {
            badges.push({ label: t("workspace.agentBar.proposal.newOperationBadge") });
          }
          // N20-02：带迭代环的 operation 标 loop ×N（真实可执行的验证/改进循环）。
          if ("loopEnabled" in data && data.loopEnabled) {
            const count = "maxLoopCount" in data ? (data.maxLoopCount ?? 3) : 3;
            badges.push({
              label: t("workspace.agentBar.proposal.loopBadge", { count }),
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
  }, [pendingOperations, pendingProposal, t]);

  const submitMessage = useCallback(
    async ({
      content,
      failedProposal,
      metadata,
      proposeAttachments,
    }: AgentConversationSubmitInput) => {
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
      const requestProgressToken =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setProgressStage(null);
      setProgressToken(requestProgressToken);

      const result = await ResultAsync.fromPromise(
        dataProvider.custom!<ProposeActionsResult>({
          method: "post",
          payload: {
            id: pipelineId,
            attachments: proposeAttachments ?? metadata.attachments ?? [],
            context: agentContext,
            diagnostics: metadata.diagnostics ?? [],
            failedProposal,
            message: trimmedContent,
            pipelineName,
            progressToken: requestProgressToken,
            referencedNodeIds: metadata.referencedNodeIds ?? [],
            snapshot: toPipelineSnapshot({ edges, nodes }),
          },
          url: "pipelines/proposeActions",
        }),
        () => null,
      );

      setProgressToken(null);
      setProgressStage(null);

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
      setSuggestedPipelineName(proposal ? (result.value.data.pipelineName ?? null) : null);
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
      agentContext,
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
    // N19-01：用户没改过名（空/默认）才采用 Agent 的建议名，绝不覆盖自定义名。
    const shouldAdoptSuggestedName =
      Boolean(suggestedPipelineName) &&
      (!pipelineName || pipelineName.trim() === "" || pipelineName === "Untitled pipeline");
    const saved = await ResultAsync.fromPromise(
      updatePipeline({
        errorNotification: false,
        id: pipelineId,
        resource: ResourceName.pipelines,
        successNotification: false,
        values: {
          edges: nextSnapshot.edges,
          nodes: nextSnapshot.nodes,
          ...(shouldAdoptSuggestedName ? { name: suggestedPipelineName } : {}),
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

    // Product guardrail: a pipeline of operations with no input source will
    // fail at run time with a confusing executor-side message. Surface the
    // gap proactively right after Apply instead (user feedback 2026-06-12).
    const INPUT_NODE_TYPES = new Set(["file", "folder", "github-project", "prompt"]);
    const hasOperationNodes = nextCanvas.nodes.some((node) => node.type === "operation");
    const hasInputNodes = nextCanvas.nodes.some((node) => INPUT_NODE_TYPES.has(node.type ?? ""));
    if (hasOperationNodes && !hasInputNodes) {
      await sendMessage({
        content: t("workspace.agentBar.replies.missingInputSource"),
        role: "assistant",
      });
    }
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
    suggestedPipelineName,
    t,
    updatePipeline,
  ]);

  const rejectProposal = useCallback(async () => {
    const rejectedSummary = pendingProposal?.summary;
    setPendingOperations([]);
    setSuggestedPipelineName(null);
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
    setSuggestedPipelineName(null);
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
    agentContext,
    applyProposal,
    progressStage,
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
