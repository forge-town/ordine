import { useState, useRef, useCallback, useEffect } from "react";
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
import type {
  AgentRuntimeConfig,
  PipelineActionProposal,
  PipelineAction,
  PipelineActionDiagnostic,
} from "@repo/schemas";
import { useCanvasPageStore } from "../_store";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import {
  pipelineAgentSessionsClient,
  type PipelineAgentPlanEvent,
} from "@/lib/pipelineAgentSessionsClient";
import { toastStore } from "@/store/toastStore";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface RuntimeState {
  runtimeOptions: AgentRuntimeConfig[];
  suggestedRuntimeId: string | null;
}

interface AttachmentItem {
  id: string;
  filename: string;
  parseStatus: string;
}

interface LocalProposalPreview {
  diagnosticsPreview: PipelineActionDiagnostic[] | null;
  proposal: PipelineActionProposal;
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
  const store = useCanvasPageStore();

  const agentPanel = useStore(store, (state) => state.agentPanel);
  const handleToggleAgentPanel = useStore(store, (state) => state.toggleAgentPanel);
  const setPendingProposal = useStore(store, (state) => state.setPendingProposal);
  const clearPendingProposal = useStore(store, (state) => state.clearPendingProposal);
  const applyAgentProposal = useStore(store, (state) => state.applyAgentProposal);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("canvas.agentPanel.welcome"),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingRuntimes, setIsLoadingRuntimes] = useState(true);
  const [needsRuntimeSetup, setNeedsRuntimeSetup] = useState(false);
  const [runtimeOptions, setRuntimeOptions] = useState<AgentRuntimeConfig[]>([]);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [localProposalPreview, setLocalProposalPreview] = useState<LocalProposalPreview | null>(
    null,
  );
  const [streamingAssistantText, setStreamingAssistantText] = useState("");
  const [streamingProgress, setStreamingProgress] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionGraphSignatureRef = useRef<string | null>(null);
  const proposalIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    });
  }, []);

  const fetchRuntimeState = useCallback(
    () =>
      ResultAsync.fromPromise(
        Promise.all([
          dataProvider.getOne!({
            resource: ResourceName.settings,
            id: "default",
          }),
          dataProvider.getList!({
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

  const ensureSession = useCallback(async () => {
    const graphSignature = JSON.stringify({
      pipelineId,
      nodes,
      edges,
    });
    if (sessionIdRef.current && sessionGraphSignatureRef.current === graphSignature) {
      return sessionIdRef.current;
    }
    const session = await pipelineAgentSessionsClient.createSession({
      entrypoint: "canvas-agent-panel",
      mode: "edit",
      ...(pipelineId ? { pipelineId } : {}),
      snapshot: { nodes, edges },
    });
    sessionIdRef.current = session.id;
    sessionGraphSignatureRef.current = graphSignature;

    return session.id;
  }, [edges, nodes, pipelineId]);

  const handlePlanEvent = useCallback(
    (event: PipelineAgentPlanEvent) => {
      if (event.type === "phase") {
        setStreamingProgress(event.phase);

        return;
      }

      if (event.type === "progress") {
        setStreamingProgress(event.message);

        return;
      }

      if (event.type === "assistant_chunk") {
        setStreamingAssistantText((current) =>
          current.length === 0 ? event.text : `${current}\n${event.text}`,
        );

        return;
      }

      if (event.type === "question") {
        setStreamingAssistantText("");
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-question-${Date.now()}`,
            role: "assistant",
            content: event.question,
          },
        ]);
        setStreamingProgress(null);
        setIsSending(false);
        scrollToBottom();

        return;
      }

      if (event.type === "proposal_ready" && event.proposal.mode === "edit") {
        const editProposal = event.proposal;
        setStreamingAssistantText("");
        proposalIdRef.current = event.proposalId;
        const nextProposal: PipelineActionProposal = {
          summary: editProposal.summary,
          actions: editProposal.actions,
        };
        setLocalProposalPreview({
          proposal: nextProposal,
          diagnosticsPreview: editProposal.diagnosticsPreview,
        });
        setPendingProposal(nextProposal, editProposal.diagnosticsPreview);
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-proposal-${Date.now()}`,
            role: "assistant",
            content: editProposal.summary,
          },
        ]);
        setStreamingProgress(null);
        setIsSending(false);
        scrollToBottom();

        return;
      }

      if (event.type === "error") {
        setStreamingAssistantText("");
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: event.message,
          },
        ]);
        setStreamingProgress(null);
        setIsSending(false);
        scrollToBottom();
      }
    },
    [scrollToBottom, setPendingProposal],
  );

  const doSend = useCallback(async () => {
    if (isSending) {
      return;
    }
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

    const previousProposalId = proposalIdRef.current;
    clearPendingProposal();

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setLocalProposalPreview(null);
    setStreamingAssistantText("");
    scrollToBottom();
    setIsSending(true);
    setStreamingProgress(null);

    const runtimeSetupResult = await fetchRuntimeState();

    if (runtimeSetupResult.isErr()) {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: t("canvas.agentPanel.error"),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      toastStore.getState().addToast({
        type: "error",
        title: t("canvas.agentPanel.errorTitle"),
        description: runtimeSetupResult.error.message,
      });
      setIsSending(false);
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
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: t("canvas.agentPanel.runtimeNotConfigured"),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsSending(false);
      scrollToBottom();

      return;
    }

    setNeedsRuntimeSetup(false);

    const sessionId = await ensureSession();
    const sendResult = await ResultAsync.fromPromise(
      (async () => {
        await pipelineAgentSessionsClient.appendMessage(sessionId, {
          role: "user",
          kind: "text",
          content: text,
        });

        const streamedTerminalEvent = { current: false };
        await pipelineAgentSessionsClient.planSessionStream(sessionId, {
          runtimeId: effectiveRuntimeId,
          onEvent: (event) => {
            if (
              event.type === "question" ||
              event.type === "error" ||
              (event.type === "proposal_ready" && event.proposal.mode === "edit")
            ) {
              streamedTerminalEvent.current = true;
            }
            handlePlanEvent(event);
          },
        });
        if (!streamedTerminalEvent.current) {
          const latestProposal = await pipelineAgentSessionsClient.getLatestReadyProposal(
            sessionId,
            "edit",
            { excludeProposalId: previousProposalId },
          );
          if (latestProposal && latestProposal.proposal.mode === "edit") {
            handlePlanEvent({
              type: "proposal_ready",
              proposal: latestProposal.proposal,
              proposalId: latestProposal.proposalId,
            });

            return;
          }

          const latestQuestion =
            await pipelineAgentSessionsClient.getLatestAssistantQuestion(sessionId);
          if (latestQuestion) {
            handlePlanEvent({
              type: "question",
              question: latestQuestion.question,
            });
          }
        }
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (sendResult.isErr()) {
      setStreamingAssistantText("");
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: sendResult.error.message,
        },
      ]);
      setStreamingProgress(null);
      setIsSending(false);
      scrollToBottom();
    }
  }, [
    inputValue,
    isSending,
    clearPendingProposal,
    pipelineId,
    ensureSession,
    fetchRuntimeState,
    handlePlanEvent,
    selectedRuntimeId,
    t,
    scrollToBottom,
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
        pipelineAgentSessionsClient.uploadAttachment(sessionId, file),
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
    [ensureSession, t],
  );

  const hasBlockingDiagnostics =
    agentPanel.diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;

  const activeProposal = agentPanel.pendingProposal ?? localProposalPreview?.proposal ?? null;
  const activeDiagnostics =
    agentPanel.diagnostics ?? localProposalPreview?.diagnosticsPreview ?? null;

  const handleApply = useCallback(() => {
    if (!activeProposal || hasBlockingDiagnostics) {
      return;
    }

    const run = async () => {
      const applied = applyAgentProposal(activeProposal);
      if (!applied) {
        return;
      }

      const approvalResult = await ResultAsync.fromPromise(
        sessionIdRef.current && proposalIdRef.current
          ? pipelineAgentSessionsClient.approveProposal(sessionIdRef.current, proposalIdRef.current)
          : Promise.resolve(),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          role: "assistant",
          content: t("canvas.agentPanel.applied"),
        },
      ]);
      setLocalProposalPreview(null);
      sessionIdRef.current = null;
      sessionGraphSignatureRef.current = null;
      proposalIdRef.current = null;
      if (approvalResult.isErr()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: approvalResult.error.message,
          },
        ]);
      }
      scrollToBottom();
    };

    void run();
  }, [activeProposal, applyAgentProposal, hasBlockingDiagnostics, scrollToBottom, t]);

  const handleDiscard = useCallback(() => {
    clearPendingProposal();
    setLocalProposalPreview(null);
    proposalIdRef.current = null;
    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        role: "assistant",
        content: t("canvas.agentPanel.discarded"),
      },
    ]);
    scrollToBottom();
  }, [clearPendingProposal, scrollToBottom, t]);

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
