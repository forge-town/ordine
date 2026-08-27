import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "zustand";
import { ChevronsRight, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResultAsync } from "neverthrow";
import type { AgentExecutionChoice, ProposeAttachment, WorkspaceCanvasRef } from "@repo/schemas";
import { useCanvasPageStore } from "../_store";
import {
  AgentExecutionPicker,
  changeExecutionRuntime,
  useAgentExecutionChoice,
} from "../../../components/AgentExecutionPicker";
import { createPipelineAgentSessionsClient } from "../../../lib/pipelineAgentSessionsClient";
import { usePlatform } from "../../../platform";
import { toastStore } from "../../../store/toastStore";
import { AgentActivityFeed } from "../../../components/AgentActivityFeed";
import { useAgentBarStore } from "./_store";
import { Assistant, MessageTurn, ProposalCard, SuggestionList } from "./messages";
import type { MessageTurnSubmitInput } from "./messages/MessageTurn";
import { Composer, type ComposerSubmitInput } from "./Composer";
import {
  hasPendingPipelinePrompt,
  takePendingPipelinePrompt,
} from "../../../lib/pendingPipelinePrompt";
import { loadGenerateSessionId } from "./generateSessionStorage";
import { buildProposalItems } from "./proposalView";
import { useAgentConversation } from "./useAgentConversation";

interface AgentPanelProps {
  onGeneratedPipeline?: (pipelineId: string) => Promise<void> | void;
}

export const AgentPanel = ({ onGeneratedPipeline }: AgentPanelProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const platform = usePlatform();
  const pipelineAgentSessionsClient = useMemo(
    () => createPipelineAgentSessionsClient(platform),
    [platform],
  );
  const store = useCanvasPageStore();

  const agentPanel = useStore(store, (state) => state.agentPanel);
  const handleToggleAgentPanel = useStore(store, (state) => state.toggleAgentPanel);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const [composerDraft, setComposerDraft] = useState<string | null>(null);
  const [isPreparingSend, setIsPreparingSend] = useState(false);
  const [isPreparingUpload, setIsPreparingUpload] = useState(false);
  const [needsRuntimeSetup, setNeedsRuntimeSetup] = useState(false);
  const {
    catalog,
    choice: executionChoice,
    isLoading: isLoadingRuntimes,
    persistChoice: handleExecutionChoiceChange,
    selectRuntime,
    settings,
  } = useAgentExecutionChoice();
  const selectedRuntimeId = executionChoice?.runtimeConfigId ?? null;
  const addMessage = useAgentBarStore((state) => state.addMessage);
  const generateProposal = useAgentBarStore((state) => state.generateProposal);
  const {
    applyProposal,
    agentContext,
    discardProposal,
    ensureSession,
    isLoading: isHistoryLoading,
    isSending: isConversationSending,
    isStopping: isConversationStopping,
    messages,
    resetSession,
    streamingAssistantText,
    streamingActivities,
    streamingProgress,
    stopConversation,
    submitMessage,
  } = useAgentConversation({ onGeneratedPipeline, pipelineId });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentGraphSignatureRef = useRef<string | null>(null);
  const pendingPromptConsumedRef = useRef(false);
  const generateSessionRestoreRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const isSending = isPreparingSend || isConversationSending;
  const isUploadBlocked = isHistoryLoading || isPreparingUpload || isSending;
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const selectedEdgeId = useStore(store, (state) => state.selectedEdgeId);
  const selectNode = useStore(store, (state) => state.selectNode);
  const selectEdge = useStore(store, (state) => state.selectEdge);
  const focusNode = useStore(store, (state) => state.focusNode);
  const focusEdge = useStore(store, (state) => state.focusEdge);
  const graphSignature = useMemo(
    () => JSON.stringify({ edges, nodes, pipelineId }),
    [edges, nodes, pipelineId],
  );
  const canvasRefs = useMemo<WorkspaceCanvasRef[]>(
    () => [
      ...nodes.map((node) => ({
        baseId: node.id,
        id: node.id,
        kind: node.type,
        label: node.data.label ?? node.id,
        path: [],
        type: "node" as const,
      })),
      ...edges.map((edge) => ({
        baseId: edge.id,
        id: edge.id,
        kind: "edge",
        label: edge.data?.label || `${edge.source} -> ${edge.target}`,
        path: [],
        type: "edge" as const,
      })),
    ],
    [edges, nodes],
  );
  const selectedRefs = useMemo<WorkspaceCanvasRef[]>(
    () =>
      agentContext.selection.map((selection) => {
        const currentRef = canvasRefs.find((ref) => ref.id === selection.refId);
        if (currentRef) {
          return currentRef;
        }

        return {
          baseId: selection.refId,
          id: selection.refId,
          kind: selection.type,
          label: selection.label ?? selection.refId,
          path: [],
          type: selection.type,
        };
      }),
    [agentContext.selection, canvasRefs],
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    });
  }, []);

  useEffect(() => {
    if (!isLoadingRuntimes) setNeedsRuntimeSetup(executionChoice === null);
  }, [executionChoice, isLoadingRuntimes]);

  useEffect(() => {
    if (
      attachmentGraphSignatureRef.current &&
      attachmentGraphSignatureRef.current !== graphSignature
    ) {
      attachmentGraphSignatureRef.current = null;
      addMessage({
        content: t("canvas.agentPanel.contextReset"),
        id: `system-context-reset-${Date.now()}`,
        role: "assistant",
      });
      resetSession();
    }
  }, [addMessage, graphSignature, resetSession, t]);

  useEffect(() => {
    scrollToBottom();
  }, [
    messages.length,
    scrollToBottom,
    streamingActivities,
    streamingAssistantText,
    streamingProgress,
  ]);

  const handleMessageSubmit = useCallback(
    ({ content, metadata, runtimeId }: MessageTurnSubmitInput) => {
      const trimmedContent = content.trim();
      if (
        !runtimeId ||
        !trimmedContent ||
        isHistoryLoading ||
        isPreparingUpload ||
        isSending ||
        agentPanel.isLoading ||
        sendInFlightRef.current
      ) {
        return;
      }

      sendInFlightRef.current = true;
      setIsPreparingSend(true);
      void submitMessage({
        content: trimmedContent,
        metadata,
        runtimeId,
        ...(executionChoice?.runtimeConfigId === runtimeId && executionChoice.model
          ? { model: executionChoice.model }
          : {}),
        ...(executionChoice?.runtimeConfigId === runtimeId && executionChoice.reasoningEffort
          ? { reasoningEffort: executionChoice.reasoningEffort }
          : {}),
        ...(executionChoice?.runtimeConfigId === runtimeId && executionChoice.speed
          ? { speed: executionChoice.speed }
          : {}),
        ...(executionChoice?.runtimeConfigId === runtimeId &&
        executionChoice.firstOutputTimeoutSeconds !== undefined
          ? { firstOutputTimeoutSeconds: executionChoice.firstOutputTimeoutSeconds }
          : {}),
      }).finally(() => {
        sendInFlightRef.current = false;
        setIsPreparingSend(false);
      });
    },
    [
      agentPanel.isLoading,
      executionChoice,
      isHistoryLoading,
      isPreparingUpload,
      isSending,
      submitMessage,
    ],
  );

  const handleOpenRuntimeSettings = useCallback(() => {
    void navigate({ to: "/runtimes" });
  }, [navigate]);

  const handleRuntimeValueChange = useCallback(
    (runtimeId: string) => {
      selectRuntime(runtimeId);
      setNeedsRuntimeSetup(false);
    },
    [selectRuntime],
  );

  const handleComposerSubmit = useCallback(
    async ({ content, metadata }: ComposerSubmitInput) => {
      if (
        isHistoryLoading ||
        isPreparingUpload ||
        isSending ||
        agentPanel.isLoading ||
        sendInFlightRef.current
      ) {
        return false;
      }

      sendInFlightRef.current = true;
      setIsPreparingSend(true);
      try {
        if (!executionChoice) {
          setNeedsRuntimeSetup(true);
          addMessage({
            content: t("canvas.agentPanel.runtimeNotConfigured"),
            id: `assistant-${Date.now()}`,
            role: "assistant",
          });
          scrollToBottom();

          return false;
        }

        setNeedsRuntimeSetup(false);
        return await submitMessage({
          content,
          metadata,
          runtimeId: executionChoice.runtimeConfigId,
          ...(executionChoice.model ? { model: executionChoice.model } : {}),
          ...(executionChoice.reasoningEffort
            ? { reasoningEffort: executionChoice.reasoningEffort }
            : {}),
          ...(executionChoice.speed ? { speed: executionChoice.speed } : {}),
          ...(executionChoice.firstOutputTimeoutSeconds === undefined
            ? {}
            : { firstOutputTimeoutSeconds: executionChoice.firstOutputTimeoutSeconds }),
        });
      } finally {
        sendInFlightRef.current = false;
        setIsPreparingSend(false);
      }
    },
    [
      agentPanel.isLoading,
      addMessage,
      executionChoice,
      isHistoryLoading,
      isPreparingUpload,
      isSending,
      scrollToBottom,
      submitMessage,
      t,
    ],
  );

  useEffect(() => {
    if (
      pendingPromptConsumedRef.current ||
      isHistoryLoading ||
      isLoadingRuntimes ||
      catalog.length === 0 ||
      isSending ||
      agentPanel.isLoading ||
      sendInFlightRef.current
    ) {
      return;
    }

    const pending = takePendingPipelinePrompt();
    if (!pending) {
      return;
    }
    pendingPromptConsumedRef.current = true;

    const pendingBaseChoice = pending.runtimeId
      ? changeExecutionRuntime(catalog, settings, pending.runtimeId)
      : executionChoice;
    const pendingChoice: AgentExecutionChoice | null = pendingBaseChoice
      ? {
          ...pendingBaseChoice,
          ...(pending.model ? { model: pending.model } : {}),
          ...(pending.reasoningEffort ? { reasoningEffort: pending.reasoningEffort } : {}),
          ...(pending.speed ? { speed: pending.speed } : {}),
          ...(pending.firstOutputTimeoutSeconds === undefined
            ? {}
            : { firstOutputTimeoutSeconds: pending.firstOutputTimeoutSeconds }),
        }
      : null;
    if (!pendingChoice) {
      setComposerDraft(pending.prompt);

      return;
    }

    handleExecutionChoiceChange(pendingChoice);
    sendInFlightRef.current = true;
    setIsPreparingSend(true);
    void submitMessage({
      content: pending.prompt,
      runtimeId: pendingChoice.runtimeConfigId,
      ...(pendingChoice.model ? { model: pendingChoice.model } : {}),
      ...(pendingChoice.reasoningEffort ? { reasoningEffort: pendingChoice.reasoningEffort } : {}),
      ...(pendingChoice.speed ? { speed: pendingChoice.speed } : {}),
      ...(pendingChoice.firstOutputTimeoutSeconds === undefined
        ? {}
        : { firstOutputTimeoutSeconds: pendingChoice.firstOutputTimeoutSeconds }),
    }).finally(() => {
      sendInFlightRef.current = false;
      setIsPreparingSend(false);
    });
  }, [
    agentPanel.isLoading,
    isHistoryLoading,
    isLoadingRuntimes,
    isSending,
    catalog,
    executionChoice,
    handleExecutionChoiceChange,
    settings,
    submitMessage,
  ]);

  useEffect(() => {
    if (
      generateSessionRestoreRef.current ||
      pendingPromptConsumedRef.current ||
      hasPendingPipelinePrompt() ||
      !loadGenerateSessionId() ||
      isHistoryLoading ||
      isLoadingRuntimes ||
      isSending ||
      agentPanel.isLoading
    ) {
      return;
    }

    generateSessionRestoreRef.current = true;
    void ensureSession();
  }, [agentPanel.isLoading, ensureSession, isHistoryLoading, isLoadingRuntimes, isSending]);

  const handleComposerAttach = useCallback(
    async (files: File[]): Promise<ProposeAttachment[]> => {
      if (isUploadBlocked) {
        return [];
      }

      setIsPreparingUpload(true);
      try {
        const sessionResult = await ResultAsync.fromPromise(ensureSession(), (error) =>
          error instanceof Error ? error : new Error(String(error)),
        );
        if (sessionResult.isErr()) {
          toastStore.getState().addToast({
            type: "error",
            title: t("canvas.agentPanel.errorTitle"),
            description: sessionResult.error.message,
          });

          return [];
        }

        const uploaded: ProposeAttachment[] = [];
        for (const file of files) {
          const uploadResult = await ResultAsync.fromPromise(
            pipelineAgentSessionsClient.uploadAttachment(
              sessionResult.value,
              file,
              selectedRuntimeId ? { runtimeId: selectedRuntimeId } : undefined,
            ),
            (error) => (error instanceof Error ? error : new Error(String(error))),
          );
          if (uploadResult.isErr()) {
            toastStore.getState().addToast({
              type: "error",
              title: t("canvas.agentPanel.errorTitle"),
              description: uploadResult.error.message,
            });
            continue;
          }

          const attachment = uploadResult.value.attachment;
          if (attachment) {
            uploaded.push({
              name: file.webkitRelativePath || attachment.filename,
              size: file.size,
              type: file.type || undefined,
            });
          }
        }
        if (uploaded.length > 0) {
          attachmentGraphSignatureRef.current = graphSignature;
        }

        return uploaded;
      } finally {
        setIsPreparingUpload(false);
      }
    },
    [
      ensureSession,
      graphSignature,
      isUploadBlocked,
      pipelineAgentSessionsClient,
      selectedRuntimeId,
      t,
    ],
  );

  const handleRemoveRef = useCallback(
    (id: string) => {
      if (selectedNodeId === id) {
        selectNode(null);
      }
      if (selectedEdgeId === id) {
        selectEdge(null);
      }
    },
    [selectEdge, selectNode, selectedEdgeId, selectedNodeId],
  );

  const handleFocusRef = useCallback(
    (ref: WorkspaceCanvasRef) => {
      if (ref.type === "edge") {
        focusEdge(ref.baseId);
      } else {
        focusNode(ref.baseId);
      }
    },
    [focusEdge, focusNode],
  );

  const hasBlockingDiagnostics =
    agentPanel.diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;
  const activeProposal = agentPanel.pendingProposal;
  const activeDiagnostics = agentPanel.diagnostics;
  const proposalNeedsAnswer =
    (activeProposal?.readiness !== undefined &&
      activeProposal.readiness !== "ready_for_generation") ||
    (activeProposal?.openQuestions?.some((question) => question.trim().length > 0) ?? false) ||
    (generateProposal !== null && generateProposal.readiness !== "ready_for_generation") ||
    (generateProposal?.openQuestions.some((question) => question.trim().length > 0) ?? false);

  const handleApply = useCallback(() => {
    if ((!activeProposal && !generateProposal) || hasBlockingDiagnostics || proposalNeedsAnswer) {
      return;
    }
    void applyProposal(selectedRuntimeId);
  }, [
    activeProposal,
    applyProposal,
    generateProposal,
    hasBlockingDiagnostics,
    proposalNeedsAnswer,
    selectedRuntimeId,
  ]);

  const handleDiscard = useCallback(() => {
    void discardProposal();
  }, [discardProposal]);

  const proposal = activeProposal;
  const hasProposal = proposal !== null || generateProposal !== null;
  const proposalItems = useMemo(() => {
    const openQuestionItems = (proposal?.openQuestions ?? generateProposal?.openQuestions ?? [])
      .map((question) => question.trim())
      .filter(Boolean)
      .map((detail) => ({
        detail,
        title: t("canvas.agentPanel.proposalDetails.openQuestion"),
      }));

    if (proposal) {
      return [...buildProposalItems(proposal, [], t), ...openQuestionItems];
    }

    if (!generateProposal) {
      return [];
    }

    return [
      ...generateProposal.inputs.map((detail) => ({ detail, title: "Input" })),
      ...generateProposal.outputs.map((detail) => ({ detail, title: "Output" })),
      ...generateProposal.majorOperations.map((detail) => ({ detail, title: "Operation" })),
      ...generateProposal.executionFlow.map((detail) => ({ detail, title: "Flow" })),
      ...openQuestionItems,
    ];
  }, [generateProposal, proposal, t]);
  const handleAskFix = useCallback(() => {
    if (selectedRuntimeId) {
      handleMessageSubmit({
        content: t("canvas.agentPanel.proposalDetails.fixDiagnostics"),
        runtimeId: selectedRuntimeId,
      });
    }
  }, [handleMessageSubmit, selectedRuntimeId, t]);
  const handleRevise = useCallback(() => {
    setComposerDraft(t("canvas.agentPanel.proposalDetails.revisePrompt"));
  }, [t]);
  const handleEmptySuggestion = useCallback(
    (content: string, submit: boolean) => {
      if (submit) {
        void handleComposerSubmit({
          content,
          metadata: { attachments: [], referencedNodeIds: [] },
        });

        return;
      }

      setComposerDraft(content);
    },
    [handleComposerSubmit],
  );
  const isConversationActive = isSending || agentPanel.isLoading;
  const handleEditDraft = useCallback((draft: string) => setComposerDraft(draft), []);
  const handleDraftConsumed = useCallback(() => setComposerDraft(null), []);
  const handleProposalAskFix = hasBlockingDiagnostics ? handleAskFix : undefined;

  return (
    <aside className="flex h-full w-full flex-col bg-surface" data-testid="canvas-agent-panel">
      <header
        className="flex shrink-0 items-center justify-between px-3.5 pb-2 pt-3"
        data-testid="canvas-agent-panel-header"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              isConversationActive
                ? "animate-pulse bg-foreground"
                : selectedRuntimeId
                  ? "bg-success"
                  : "bg-muted-foreground/45",
            )}
            data-testid="canvas-agent-panel-status-dot"
          />
          <span className="truncate text-[12px] font-semibold">{t("canvas.agentPanel.title")}</span>
          <span className="truncate text-[10.5px] text-muted-foreground">·</span>
          <span className="sr-only">{t("canvas.agentPanel.runtimeLabel")}</span>
          <AgentExecutionPicker
            compact
            catalog={catalog}
            choice={executionChoice}
            isLoading={isLoadingRuntimes}
            onChange={handleExecutionChoiceChange}
            onOpenSettings={handleOpenRuntimeSettings}
            onRuntimeChange={handleRuntimeValueChange}
          />
        </div>
        <Button
          aria-label={t("canvas.agentPanel.close")}
          className="h-7 w-7 shrink-0"
          data-testid="canvas-agent-panel-collapse"
          size="icon"
          title={t("canvas.agentPanel.close")}
          variant="ghost"
          onClick={handleToggleAgentPanel}
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </header>

      <div
        className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3"
        data-testid="canvas-agent-panel-messages"
      >
        {messages.length === 0 && (
          <div data-testid="agent-empty-state">
            <Assistant>{t("canvas.agentPanel.empty.intro")}</Assistant>
            <SuggestionList
              items={[
                {
                  id: "quiz",
                  label: t("canvas.agentPanel.empty.suggestQuiz"),
                  onSelect: () =>
                    handleEmptySuggestion(t("canvas.agentPanel.empty.suggestQuiz"), true),
                },
                {
                  id: "changelog",
                  label: t("canvas.agentPanel.empty.suggestChangelog"),
                  onSelect: () =>
                    handleEmptySuggestion(t("canvas.agentPanel.empty.suggestChangelog"), true),
                },
                {
                  id: "reverse",
                  label: t("canvas.agentPanel.empty.suggestReverse"),
                  onSelect: () =>
                    handleEmptySuggestion(t("canvas.agentPanel.empty.suggestReverse"), false),
                  reverse: true,
                },
              ]}
            />
          </div>
        )}
        {messages.map((msg, index) => (
          <MessageTurn
            key={msg.id}
            isLast={index === messages.length - 1}
            isSending={isSending || isPreparingUpload || isHistoryLoading || agentPanel.isLoading}
            message={msg}
            refs={canvasRefs}
            runtimeId={selectedRuntimeId}
            visibleMessages={messages}
            onEditDraft={handleEditDraft}
            onOpenSettings={handleOpenRuntimeSettings}
            onSubmit={handleMessageSubmit}
          />
        ))}
        {streamingAssistantText && (
          <Assistant className="whitespace-pre-wrap">{streamingAssistantText}</Assistant>
        )}

        <AgentActivityFeed active={isConversationActive} entries={streamingActivities} />

        {isConversationActive && streamingActivities.length === 0 && (
          <Assistant isThinking>{streamingProgress ?? t("canvas.agentPanel.thinking")}</Assistant>
        )}
        <div ref={messagesEndRef} />

        {/* Diagnostics */}
        {activeDiagnostics && activeDiagnostics.length > 0 && (
          <div className="border-t">
            <div className="flex flex-col gap-2 p-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("canvas.agentPanel.diagnostics")}
              </span>
              {activeDiagnostics.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2.5 py-2 text-xs",
                    d.severity === "error"
                      ? "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                      : "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {d.severity === "error" ? (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{d.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proposal */}
        {hasProposal && (
          <div className="border-t">
            <div className="flex flex-col gap-2 p-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("canvas.agentPanel.proposal")}
              </span>
              <ProposalCard
                applyDisabled={proposalNeedsAnswer}
                disabled={
                  isSending || isPreparingUpload || isHistoryLoading || agentPanel.isLoading
                }
                items={proposalItems}
                subtitle={t(
                  proposalNeedsAnswer
                    ? "canvas.agentPanel.proposalDetails.needsAnswer"
                    : "canvas.agentPanel.proposalDetails.review",
                )}
                title={proposal?.summary ?? generateProposal?.purpose ?? ""}
                onApply={handleApply}
                onAskFix={handleProposalAskFix}
                onReject={handleDiscard}
                onRevise={handleRevise}
              />
            </div>
          </div>
        )}
      </div>

      {needsRuntimeSetup && (
        <div className="border-t bg-amber-500/10">
          <div className="flex items-center gap-2 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{t("canvas.agentPanel.runtimeNotConfigured")}</span>
            <a className="font-medium underline underline-offset-2" href="/runtimes">
              {t("canvas.agentPanel.goToRuntimeSettings")}
            </a>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-border/70">
        <Composer
          agentContext={agentContext}
          canRemoveAttachments={false}
          clearAttachmentsOnSubmit={false}
          disabled={
            isHistoryLoading || isLoadingRuntimes || isPreparingUpload || agentPanel.isLoading
          }
          draft={composerDraft}
          isSending={isSending}
          isStopping={isConversationStopping}
          refs={selectedRefs}
          resetKey={graphSignature}
          runtimeId={selectedRuntimeId}
          onAttach={handleComposerAttach}
          onDraftConsumed={handleDraftConsumed}
          onFocusRef={handleFocusRef}
          onRemoveRef={handleRemoveRef}
          onSubmit={handleComposerSubmit}
          onStop={stopConversation}
        />
      </div>
    </aside>
  );
};
