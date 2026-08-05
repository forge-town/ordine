import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  Bot,
  X,
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
    if (isSending || sendInFlightRef.current) {
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

  const handleUploadButtonClick = useCallback(() => {
    void ensureSession().then(() => fileInputRef.current?.click());
  }, [ensureSession]);

  const handleUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      event.target.value = "";

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
    },
    [edges, ensureSession, nodes, pipelineAgentSessionsClient, pipelineId, selectedRuntimeId, t],
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

  return (
    <div className="absolute bottom-0 right-0 top-0 z-30 flex w-80 flex-col border-l bg-background shadow-lg">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4 text-primary" />
          <span>{t("canvas.agentPanel.title")}</span>
        </div>
        <Button
          aria-label={t("canvas.agentPanel.close")}
          className="h-7 w-7"
          size="icon"
          title={t("canvas.agentPanel.close")}
          variant="ghost"
          onClick={handleToggleAgentPanel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="border-b px-3 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("canvas.agentPanel.runtimeLabel")}
          </span>
          <Select value={selectedRuntimeId} onValueChange={handleRuntimeValueChange}>
            <SelectTrigger
              className="h-8 w-full text-xs"
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
            type="file"
            onChange={handleUploadChange}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={handleUploadButtonClick}>
              <Upload className="h-3.5 w-3.5" />
              {t("canvas.agentPanel.upload")}
            </Button>
            {attachments.map((attachment) => (
              <span key={attachment.id} className="rounded-md border px-2 py-1 text-xs">
                {attachment.filename}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && (
            <div className="mr-auto max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm">
              {t("canvas.agentPanel.welcome")}
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted",
              )}
            >
              {msg.content}
            </div>
          ))}
          {streamingAssistantText && (
            <div className="mr-auto max-w-[90%] whitespace-pre-wrap rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {streamingAssistantText}
            </div>
          )}

          {(isSending || agentPanel.isLoading) && (
            <div className="mr-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {streamingProgress ?? t("canvas.agentPanel.thinking")}
            </div>
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
      <div className="flex items-center gap-2 border-t p-3">
        <Input
          className="h-9 flex-1 text-sm"
          disabled={isSending || agentPanel.isLoading || isLoadingRuntimes}
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
          {isSending || agentPanel.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
