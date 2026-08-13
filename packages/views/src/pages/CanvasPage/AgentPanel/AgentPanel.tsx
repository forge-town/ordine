import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Bot, ChevronsRight, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { ResultAsync } from "neverthrow";
import type { AgentRuntimeConfig, ProposeAttachment, WorkspaceCanvasRef } from "@repo/schemas";
import { useCanvasPageStore } from "../_store";
import { ResourceName } from "../../../constants";
import { getCanvasDataProvider } from "../../../lib/canvasDataProvider";
import { createPipelineAgentSessionsClient } from "../../../lib/pipelineAgentSessionsClient";
import { usePlatform } from "../../../platform";
import { toastStore } from "../../../store/toastStore";
import { useAgentBarStore } from "./_store";
import { Assistant, MessageTurn, ProposalCard } from "./messages";
import type { MessageTurnSubmitInput } from "./messages/MessageTurn";
import { Composer, type ComposerSubmitInput } from "./Composer";
import { takePendingPipelinePrompt } from "./pendingPipelinePrompt";
import { buildProposalItems } from "./proposalView";
import { useAgentConversation } from "./useAgentConversation";

interface RuntimeState {
  runtimeOptions: AgentRuntimeConfig[];
  suggestedRuntimeId: string | null;
}

interface AgentPanelProps {
  onGeneratedPipeline?: (pipelineId: string) => Promise<void> | void;
}

const formatRuntimeLabel = (runtime: AgentRuntimeConfig): string =>
  runtime.name === runtime.type ? runtime.name : `${runtime.name} (${runtime.type})`;

export const AgentPanel = ({ onGeneratedPipeline }: AgentPanelProps) => {
  const { t } = useTranslation();
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
  const [isLoadingRuntimes, setIsLoadingRuntimes] = useState(true);
  const [needsRuntimeSetup, setNeedsRuntimeSetup] = useState(false);
  const [runtimeOptions, setRuntimeOptions] = useState<AgentRuntimeConfig[]>([]);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const addMessage = useAgentBarStore((state) => state.addMessage);
  const generateProposal = useAgentBarStore((state) => state.generateProposal);
  const {
    applyProposal,
    agentContext,
    discardProposal,
    ensureSession,
    isLoading: isHistoryLoading,
    isSending: isConversationSending,
    messages,
    resetSession,
    streamingAssistantText,
    streamingProgress,
    submitMessage,
  } = useAgentConversation({ onGeneratedPipeline, pipelineId });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentGraphSignatureRef = useRef<string | null>(null);
  const pendingPromptConsumedRef = useRef(false);
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

  const fetchRuntimeState = useCallback(
    () =>
      ResultAsync.fromPromise(
        Promise.all([
          getCanvasDataProvider().getOne!({
            resource: ResourceName.settings,
            id: "default",
          }),
          getCanvasDataProvider().getList!({
            resource: ResourceName.agentRuntimes,
          }),
        ]),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      ).map(([settingsResult, runtimesResult]) => {
        const settings = settingsResult.data as { defaultAgentRuntime?: string };
        const nextRuntimeOptions = (runtimesResult.data as AgentRuntimeConfig[]) ?? [];
        const preferredRuntime =
          nextRuntimeOptions.find((runtime) => runtime.type === settings.defaultAgentRuntime) ??
          nextRuntimeOptions[0] ??
          null;

        return {
          runtimeOptions: nextRuntimeOptions,
          suggestedRuntimeId: preferredRuntime?.id ?? null,
        } satisfies RuntimeState;
      }),
    [],
  );

  useEffect(() => {
    setIsLoadingRuntimes(true);
    void fetchRuntimeState().match(
      ({ runtimeOptions: nextRuntimeOptions, suggestedRuntimeId }) => {
        setRuntimeOptions(nextRuntimeOptions);
        setSelectedRuntimeId((currentRuntimeId) =>
          currentRuntimeId && nextRuntimeOptions.some((runtime) => runtime.id === currentRuntimeId)
            ? currentRuntimeId
            : suggestedRuntimeId,
        );
        setNeedsRuntimeSetup(nextRuntimeOptions.length === 0);
        setIsLoadingRuntimes(false);
      },
      () => {
        setRuntimeOptions([]);
        setSelectedRuntimeId(null);
        setNeedsRuntimeSetup(true);
        setIsLoadingRuntimes(false);
      },
    );
  }, [fetchRuntimeState]);

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
  }, [messages.length, scrollToBottom, streamingAssistantText, streamingProgress]);

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
      void submitMessage({ content: trimmedContent, metadata, runtimeId }).finally(() => {
        sendInFlightRef.current = false;
        setIsPreparingSend(false);
      });
    },
    [agentPanel.isLoading, isHistoryLoading, isPreparingUpload, isSending, submitMessage],
  );

  const handleOpenRuntimeSettings = useCallback(() => {
    setNeedsRuntimeSetup(true);
  }, []);

  const handleRuntimeValueChange = useCallback((runtimeId: string | null) => {
    setSelectedRuntimeId(runtimeId);
    setNeedsRuntimeSetup(false);
  }, []);

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
        const runtimeSetupResult = await fetchRuntimeState();
        if (runtimeSetupResult.isErr()) {
          addMessage({
            content: t("canvas.agentPanel.error"),
            id: `assistant-${Date.now()}`,
            role: "assistant",
          });
          toastStore.getState().addToast({
            type: "error",
            title: t("canvas.agentPanel.errorTitle"),
            description: runtimeSetupResult.error.message,
          });
          scrollToBottom();

          return false;
        }

        const { runtimeOptions: nextRuntimeOptions, suggestedRuntimeId } = runtimeSetupResult.value;
        setRuntimeOptions(nextRuntimeOptions);
        const effectiveRuntimeId =
          selectedRuntimeId &&
          nextRuntimeOptions.some((runtime) => runtime.id === selectedRuntimeId)
            ? selectedRuntimeId
            : suggestedRuntimeId;
        setSelectedRuntimeId(effectiveRuntimeId);
        if (!effectiveRuntimeId) {
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
        return await submitMessage({ content, metadata, runtimeId: effectiveRuntimeId });
      } finally {
        sendInFlightRef.current = false;
        setIsPreparingSend(false);
      }
    },
    [
      addMessage,
      agentPanel.isLoading,
      fetchRuntimeState,
      isHistoryLoading,
      isPreparingUpload,
      isSending,
      pipelineId,
      scrollToBottom,
      selectedRuntimeId,
      submitMessage,
      t,
    ],
  );

  useEffect(() => {
    if (
      pendingPromptConsumedRef.current ||
      isHistoryLoading ||
      isLoadingRuntimes ||
      runtimeOptions.length === 0 ||
      isSending ||
      agentPanel.isLoading ||
      sendInFlightRef.current
    ) {
      return;
    }

    pendingPromptConsumedRef.current = true;
    const pending = takePendingPipelinePrompt();
    if (!pending) {
      return;
    }

    const effectiveRuntimeId =
      runtimeOptions.find((runtime) => runtime.id === pending.runtimeId)?.id ?? selectedRuntimeId;
    if (!effectiveRuntimeId) {
      setComposerDraft(pending.prompt);

      return;
    }

    setSelectedRuntimeId(effectiveRuntimeId);
    sendInFlightRef.current = true;
    setIsPreparingSend(true);
    void submitMessage({ content: pending.prompt, runtimeId: effectiveRuntimeId }).finally(() => {
      sendInFlightRef.current = false;
      setIsPreparingSend(false);
    });
  }, [
    agentPanel.isLoading,
    isHistoryLoading,
    isLoadingRuntimes,
    isSending,
    pipelineId,
    runtimeOptions,
    selectedRuntimeId,
    submitMessage,
  ]);

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
  const generateProposalNeedsAnswer =
    generateProposal !== null && generateProposal.readiness !== "ready_for_generation";

  const activeProposal = agentPanel.pendingProposal;
  const activeDiagnostics = agentPanel.diagnostics;

  const handleApply = useCallback(() => {
    if (
      (!activeProposal && !generateProposal) ||
      hasBlockingDiagnostics ||
      generateProposalNeedsAnswer
    ) {
      return;
    }
    void applyProposal(selectedRuntimeId);
  }, [
    activeProposal,
    applyProposal,
    generateProposal,
    generateProposalNeedsAnswer,
    hasBlockingDiagnostics,
    selectedRuntimeId,
  ]);

  const handleDiscard = useCallback(() => {
    void discardProposal();
  }, [discardProposal]);

  const proposal = activeProposal;
  const hasProposal = proposal !== null || generateProposal !== null;
  const proposalItems = useMemo(() => {
    if (proposal) {
      return buildProposalItems(proposal, [], t);
    }

    if (!generateProposal) {
      return [];
    }

    return [
      ...generateProposal.inputs.map((detail) => ({ detail, title: "Input" })),
      ...generateProposal.outputs.map((detail) => ({ detail, title: "Output" })),
      ...generateProposal.majorOperations.map((detail) => ({ detail, title: "Operation" })),
      ...generateProposal.executionFlow.map((detail) => ({ detail, title: "Flow" })),
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
  const selectedRuntime = runtimeOptions.find((runtime) => runtime.id === selectedRuntimeId);
  const isConversationActive = isSending || agentPanel.isLoading;
  const headerSubtitle = isConversationActive
    ? (streamingProgress ?? t("canvas.agentPanel.thinking"))
    : selectedRuntime
      ? formatRuntimeLabel(selectedRuntime)
      : t("canvas.agentPanel.runtimePlaceholder");

  return (
    <aside className="flex h-full w-full flex-col bg-surface" data-testid="canvas-agent-panel">
      <header
        className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 px-3"
        data-testid="canvas-agent-panel-header"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground ring-1 ring-border">
            <Bot className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold">{t("canvas.agentPanel.title")}</div>
            <div className="flex min-w-0 items-center gap-1.5">
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
              <span className="truncate text-[10.5px] text-muted-foreground">{headerSubtitle}</span>
            </div>
          </div>
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
        className="mx-3 mb-1 rounded-lg bg-surface-2 px-2.5 py-2 ring-1 ring-border-strong"
        data-testid="canvas-agent-panel-runtime-context"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-medium text-muted-foreground">
            {t("canvas.agentPanel.runtimeLabel")}
          </span>
          <Select value={selectedRuntimeId} onValueChange={handleRuntimeValueChange}>
            <SelectTrigger
              aria-label={t("canvas.agentPanel.runtimeLabel")}
              className="h-7 w-full text-[11px]"
              disabled={isLoadingRuntimes || runtimeOptions.length === 0}
            >
              <SelectValue
                placeholder={
                  isLoadingRuntimes
                    ? t("canvas.agentPanel.runtimeLoading")
                    : t("canvas.agentPanel.runtimePlaceholder")
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {runtimeOptions.map((runtime) => (
                  <SelectItem key={runtime.id} value={runtime.id}>
                    {formatRuntimeLabel(runtime)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1" data-testid="canvas-agent-panel-messages">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && <Assistant>{t("canvas.agentPanel.welcome")}</Assistant>}
          {messages.map((msg, index) => (
            <MessageTurn
              key={msg.id}
              isLast={index === messages.length - 1}
              isSending={isSending || isPreparingUpload || isHistoryLoading || agentPanel.isLoading}
              message={msg}
              runtimeId={selectedRuntimeId}
              refs={canvasRefs}
              visibleMessages={messages}
              onEditDraft={setComposerDraft}
              onOpenSettings={handleOpenRuntimeSettings}
              onSubmit={handleMessageSubmit}
            />
          ))}
          {streamingAssistantText && (
            <Assistant className="whitespace-pre-wrap">{streamingAssistantText}</Assistant>
          )}

          {isConversationActive && (
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
                  disabled={
                    isSending ||
                    isPreparingUpload ||
                    isHistoryLoading ||
                    agentPanel.isLoading ||
                    generateProposalNeedsAnswer
                  }
                  items={proposalItems}
                  onApply={handleApply}
                  onAskFix={hasBlockingDiagnostics ? handleAskFix : undefined}
                  onReject={handleDiscard}
                  onRevise={handleRevise}
                  subtitle={t("canvas.agentPanel.proposal.review")}
                  title={proposal?.summary ?? generateProposal?.purpose ?? ""}
                />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

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

      <div className="shrink-0 border-t border-border/70 bg-surface">
        <Composer
          agentContext={agentContext}
          canRemoveAttachments={false}
          clearAttachmentsOnSubmit={false}
          disabled={
            isHistoryLoading || isLoadingRuntimes || isPreparingUpload || agentPanel.isLoading
          }
          draft={composerDraft}
          isSending={isSending}
          onAttach={handleComposerAttach}
          onDraftConsumed={() => setComposerDraft(null)}
          onFocusRef={handleFocusRef}
          onRemoveRef={handleRemoveRef}
          onSubmit={handleComposerSubmit}
          refs={selectedRefs}
          resetKey={graphSignature}
          runtimeId={selectedRuntimeId}
        />
      </div>
    </aside>
  );
};
