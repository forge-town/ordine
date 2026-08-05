import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  ChevronsRight,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Check,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Input } from "@repo/ui/input";
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
import type { AgentRuntimeConfig, PipelineAction } from "@repo/schemas";
import { useCanvasPageStore } from "../_store";
import { ResourceName } from "../../../constants";
import { getCanvasDataProvider } from "../../../lib/canvasDataProvider";
import { createPipelineAgentSessionsClient } from "../../../lib/pipelineAgentSessionsClient";
import { usePlatform } from "../../../platform";
import { toastStore } from "../../../store/toastStore";
import { useAgentBarStore } from "./_store";
import { Assistant, Bubble } from "./messages";
import { useAgentConversation } from "./useAgentConversation";

interface RuntimeState {
  runtimeOptions: AgentRuntimeConfig[];
  suggestedRuntimeId: string | null;
}

interface AttachmentItem {
  id: string;
  filename: string;
  parseStatus: string;
}

const getActionLabel = (
  action: PipelineAction,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  switch (action.type) {
    case "addNode": {
      return t("canvas.agentPanel.action.addNode", { type: action.node.type });
    }
    case "removeNode": {
      return t("canvas.agentPanel.action.removeNode", { nodeId: action.nodeId });
    }
    case "addEdge": {
      return t("canvas.agentPanel.action.addEdge", {
        source: action.edge.source,
        target: action.edge.target,
      });
    }
    case "removeEdge": {
      return t("canvas.agentPanel.action.removeEdge", { edgeId: action.edgeId });
    }
    case "reconnectEdge": {
      return t("canvas.agentPanel.action.reconnectEdge", { edgeId: action.edgeId });
    }
    case "replaceNodeData": {
      return t("canvas.agentPanel.action.replaceNodeData", { nodeId: action.nodeId });
    }
    default: {
      return (action as { type: string }).type;
    }
  }
};

const formatRuntimeLabel = (runtime: AgentRuntimeConfig): string =>
  runtime.name === runtime.type ? runtime.name : `${runtime.name} (${runtime.type})`;

export const AgentPanel = () => {
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
  const [inputValue, setInputValue] = useState("");
  const [isPreparingSend, setIsPreparingSend] = useState(false);
  const [isPreparingUpload, setIsPreparingUpload] = useState(false);
  const [isLoadingRuntimes, setIsLoadingRuntimes] = useState(true);
  const [needsRuntimeSetup, setNeedsRuntimeSetup] = useState(false);
  const [runtimeOptions, setRuntimeOptions] = useState<AgentRuntimeConfig[]>([]);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const addMessage = useAgentBarStore((state) => state.addMessage);
  const {
    applyProposal,
    discardProposal,
    ensureSession,
    isLoading: isHistoryLoading,
    isSending: isConversationSending,
    messages,
    resetSession,
    streamingAssistantText,
    streamingProgress,
    submitMessage,
  } = useAgentConversation({ pipelineId });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentGraphSignatureRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);
  const isSending = isPreparingSend || isConversationSending;
  const isUploadBlocked = isHistoryLoading || isPreparingUpload || isSending;

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
    const graphSignature = JSON.stringify({ edges, nodes, pipelineId });
    if (
      attachments.length > 0 &&
      attachmentGraphSignatureRef.current &&
      attachmentGraphSignatureRef.current !== graphSignature
    ) {
      setAttachments([]);
      attachmentGraphSignatureRef.current = null;
      addMessage({
        content: t("canvas.agentPanel.contextReset"),
        id: `system-context-reset-${Date.now()}`,
        role: "assistant",
      });
      resetSession();
    }
  }, [addMessage, attachments.length, edges, nodes, pipelineId, resetSession, t]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom, streamingAssistantText, streamingProgress]);

  const doSend = useCallback(async () => {
    if (isHistoryLoading || isSending || sendInFlightRef.current) {
      return;
    }
    sendInFlightRef.current = true;
    setIsPreparingSend(true);
    try {
      const text = inputValue.trim();
      if (!text) {
        return;
      }
      if (!pipelineId) {
        toastStore.getState().addToast({
          type: "error",
          title: t("canvas.runFailed"),
          description: t("canvas.noPipelineId"),
        });

        return;
      }

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

        return;
      }

      const { runtimeOptions: nextRuntimeOptions, suggestedRuntimeId } = runtimeSetupResult.value;
      setRuntimeOptions(nextRuntimeOptions);
      const effectiveRuntimeId =
        selectedRuntimeId && nextRuntimeOptions.some((runtime) => runtime.id === selectedRuntimeId)
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

        return;
      }

      setNeedsRuntimeSetup(false);
      setInputValue("");
      await submitMessage({ content: text, runtimeId: effectiveRuntimeId });
    } finally {
      sendInFlightRef.current = false;
      setIsPreparingSend(false);
    }
  }, [
    addMessage,
    fetchRuntimeState,
    inputValue,
    isHistoryLoading,
    isSending,
    pipelineId,
    selectedRuntimeId,
    scrollToBottom,
    submitMessage,
    t,
  ]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void doSend();
      }
    },
    [doSend],
  );

  const handleInputValueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  }, []);

  const handleRuntimeValueChange = useCallback((runtimeId: string | null) => {
    setSelectedRuntimeId(runtimeId);
    setNeedsRuntimeSetup(false);
  }, []);

  const handleSendClick = useCallback(() => {
    void doSend();
  }, [doSend]);

  const handleUploadButtonClick = useCallback(async () => {
    if (isUploadBlocked) {
      return;
    }

    setIsPreparingUpload(true);
    try {
      await ensureSession();
      fileInputRef.current?.click();
    } finally {
      setIsPreparingUpload(false);
    }
  }, [ensureSession, isUploadBlocked]);

  const handleUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || isUploadBlocked) {
        return;
      }

      setIsPreparingUpload(true);
      try {
        const sessionId = await ensureSession();
        const uploadResult = await ResultAsync.fromPromise(
          pipelineAgentSessionsClient.uploadAttachment(
            sessionId,
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

          return;
        }

        const attachment = uploadResult.value.attachment;
        if (attachment) {
          attachmentGraphSignatureRef.current = JSON.stringify({ edges, nodes, pipelineId });
          setAttachments((prev) => [
            ...prev,
            {
              id: attachment.id,
              filename: attachment.filename,
              parseStatus: attachment.parseStatus ?? "parsed",
            },
          ]);
        }
      } finally {
        setIsPreparingUpload(false);
      }
    },
    [
      edges,
      ensureSession,
      isUploadBlocked,
      nodes,
      pipelineAgentSessionsClient,
      pipelineId,
      selectedRuntimeId,
      t,
    ],
  );

  const hasBlockingDiagnostics =
    agentPanel.diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;

  const activeProposal = agentPanel.pendingProposal;
  const activeDiagnostics = agentPanel.diagnostics;

  const handleApply = useCallback(() => {
    if (!activeProposal || hasBlockingDiagnostics) {
      return;
    }
    void applyProposal();
  }, [activeProposal, applyProposal, hasBlockingDiagnostics]);

  const handleDiscard = useCallback(() => {
    void discardProposal();
  }, [discardProposal]);

  const proposal = activeProposal;
  const hasProposal = proposal !== null;
  const canApplyProposal = hasProposal && !hasBlockingDiagnostics;
  const selectedRuntime = runtimeOptions.find((runtime) => runtime.id === selectedRuntimeId);
  const isConversationActive = isSending || agentPanel.isLoading;
  const headerSubtitle = isConversationActive
    ? (streamingProgress ?? t("canvas.agentPanel.thinking"))
    : selectedRuntime
      ? formatRuntimeLabel(selectedRuntime)
      : t("canvas.agentPanel.runtimePlaceholder");

  return (
    <div
      className="absolute bottom-0 right-0 top-0 z-30 flex w-[min(22.5rem,100%)] flex-col border-l bg-surface"
      data-testid="canvas-agent-panel"
    >
      <header
        className="flex shrink-0 items-center justify-between px-3.5 pb-2 pt-3"
        data-testid="canvas-agent-panel-header"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              isConversationActive ? "animate-pulse bg-foreground" : "bg-success",
            )}
            data-testid="canvas-agent-panel-status-dot"
          />
          <span className="text-[12px] font-semibold">{t("canvas.agentPanel.title")}</span>
          <span className="truncate text-[10.5px] text-muted-foreground">· {headerSubtitle}</span>
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
          <input
            ref={fileInputRef}
            aria-label={t("canvas.agentPanel.upload")}
            className="hidden"
            disabled={isUploadBlocked}
            type="file"
            onChange={handleUploadChange}
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <Button
              className="h-7 px-2 text-[10.5px]"
              disabled={isUploadBlocked}
              size="sm"
              variant="outline"
              onClick={handleUploadButtonClick}
            >
              <Upload className="h-3.5 w-3.5" />
              {t("canvas.agentPanel.upload")}
            </Button>
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="rounded-md border border-border-strong bg-surface px-1.5 py-0.5 text-[10.5px]"
              >
                {attachment.filename}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1" data-testid="canvas-agent-panel-messages">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && <Assistant>{t("canvas.agentPanel.welcome")}</Assistant>}
          {messages.map((msg) =>
            msg.role === "user" ? (
              <Bubble
                key={msg.id}
                attachmentLabel={msg.metadata?.attachments
                  ?.map((attachment) => attachment.name)
                  .join(", ")}
              >
                {msg.content}
              </Bubble>
            ) : (
              <Assistant key={msg.id}>{msg.content}</Assistant>
            ),
          )}
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
                        ? "border border-red-200 bg-red-50 text-red-700"
                        : "border border-amber-200 bg-amber-50 text-amber-700",
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
                <div className="rounded-md border bg-muted/50 p-2.5">
                  <p className="mb-2 text-xs font-medium">{proposal.summary}</p>
                  <ul className="flex flex-col gap-1">
                    {proposal.actions.map((action, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                        {getActionLabel(action, t)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className="h-8 flex-1 gap-1 text-xs"
                    disabled={isSending || agentPanel.isLoading || !canApplyProposal}
                    size="sm"
                    variant="default"
                    onClick={handleApply}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t("canvas.agentPanel.apply")}
                  </Button>
                  <Button
                    className="h-8 flex-1 gap-1 text-xs"
                    disabled={isSending || agentPanel.isLoading}
                    size="sm"
                    variant="outline"
                    onClick={handleDiscard}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("canvas.agentPanel.discard")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {needsRuntimeSetup && (
        <div className="border-t bg-amber-50/70">
          <div className="flex items-center gap-2 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{t("canvas.agentPanel.runtimeNotConfigured")}</span>
            <a className="font-medium underline underline-offset-2" href="/runtimes">
              {t("canvas.agentPanel.goToRuntimeSettings")}
            </a>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border/70 bg-surface p-3">
        <Input
          className="h-9 flex-1 bg-surface-2 text-[12px]"
          disabled={isSending || isHistoryLoading || agentPanel.isLoading || isLoadingRuntimes}
          placeholder={t("canvas.agentPanel.inputPlaceholder")}
          value={inputValue}
          onChange={handleInputValueChange}
          onKeyDown={handleKeyDown}
        />
        <Button
          aria-label={t("canvas.agentPanel.send")}
          className="h-9 w-9"
          disabled={
            isSending ||
            isHistoryLoading ||
            agentPanel.isLoading ||
            isLoadingRuntimes ||
            !selectedRuntimeId ||
            !inputValue.trim()
          }
          size="icon"
          title={t("canvas.agentPanel.send")}
          variant="ghost"
          onClick={handleSendClick}
        >
          {isSending || isHistoryLoading || agentPanel.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
