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

const getActionLabel = (action: PipelineAction): string => {
  switch (action.type) {
    case "addNode": {
      return `添加节点: ${action.node.type}`;
    }
    case "removeNode": {
      return `删除节点: ${action.nodeId}`;
    }
    case "addEdge": {
      return `添加连线: ${action.edge.source} → ${action.edge.target}`;
    }
    case "removeEdge": {
      return `删除连线: ${action.edgeId}`;
    }
    case "reconnectEdge": {
      return `重连连线: ${action.edgeId}`;
    }
    case "replaceNodeData": {
      return `替换节点数据: ${action.nodeId}`;
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
  const handleToggleAgentPanel = useStore(
    store,
    (state) => state.toggleAgentPanel,
  );
  const setPendingProposal = useStore(
    store,
    (state) => state.setPendingProposal,
  );
  const clearPendingProposal = useStore(
    store,
    (state) => state.clearPendingProposal,
  );
  const applyAgentProposal = useStore(
    store,
    (state) => state.applyAgentProposal,
  );
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    clearPendingProposal();

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    scrollToBottom();
    setIsSending(true);

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

    const {
      runtimeOptions: nextRuntimeOptions,
      suggestedRuntimeId,
    } = runtimeSetupResult.value;
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

    const result = await ResultAsync.fromPromise(
      dataProvider.custom!({
        url: "pipelines/proposeActions",
        method: "post",
        payload: {
          id: pipelineId,
          snapshot: { nodes, edges },
          message: text,
          pipelineName,
          runtimeId: effectiveRuntimeId,
        },
      }),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );

    if (result.isErr()) {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: t("canvas.agentPanel.error"),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      toastStore.getState().addToast({
        type: "error",
        title: t("canvas.agentPanel.errorTitle"),
        description: result.error.message,
      });
      setIsSending(false);
      scrollToBottom();

      return;
    }

    const data = result.value.data as {
      proposal?: PipelineActionProposal | null;
      diagnostics?: PipelineActionDiagnostic[] | null;
      reply?: string;
    };

    const proposal = data.proposal ?? null;
    const diagnostics = data.diagnostics ?? null;
    const reply =
      data.reply ??
      (proposal
        ? t("canvas.agentPanel.proposalReceived")
        : t("canvas.agentPanel.noProposal"));

    setPendingProposal(proposal, diagnostics);

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: reply,
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setIsSending(false);
    scrollToBottom();
  }, [
    inputValue,
    isSending,
    clearPendingProposal,
    pipelineId,
    fetchRuntimeState,
    selectedRuntimeId,
    t,
    setPendingProposal,
    scrollToBottom,
    nodes,
    edges,
    pipelineName,
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

  const handleInputValueChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);
    },
    [],
  );

  const handleRuntimeValueChange = useCallback((runtimeId: string | null) => {
    setSelectedRuntimeId(runtimeId);
    setNeedsRuntimeSetup(false);
  }, []);

  const handleSendClick = useCallback(() => {
    void doSend();
  }, [doSend]);

  const hasBlockingDiagnostics =
    agentPanel.diagnostics?.some(
      (diagnostic) => diagnostic.severity === "error",
    ) ?? false;

  const handleApply = useCallback(() => {
    if (!agentPanel.pendingProposal || hasBlockingDiagnostics) {
      return;
    }

    const applied = applyAgentProposal(agentPanel.pendingProposal);
    if (!applied) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        role: "assistant",
        content: t("canvas.agentPanel.applied"),
      },
    ]);
    scrollToBottom();
  }, [
    agentPanel.pendingProposal,
    applyAgentProposal,
    hasBlockingDiagnostics,
    scrollToBottom,
    t,
  ]);

  const handleDiscard = useCallback(() => {
    clearPendingProposal();
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

  const proposal =
    agentPanel.pendingProposal as PipelineActionProposal | null;
  const hasProposal = proposal !== null;

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
          onClick={handleToggleAgentPanel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="border-b px-3 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("canvas.agentPanel.runtimeLabel")}
          </span>
          <Select
            value={selectedRuntimeId}
            onValueChange={handleRuntimeValueChange}
          >
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
              )}>
              {msg.content}
            </div>
          ))}

          {(isSending || agentPanel.isLoading) && (
            <div className="mr-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("canvas.agentPanel.thinking")}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Diagnostics */}
      {agentPanel.diagnostics && agentPanel.diagnostics.length > 0 && (
        <div className="border-t">
          <div className="flex flex-col gap-2 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t("canvas.agentPanel.diagnostics")}
            </span>
            {agentPanel.diagnostics.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2.5 py-2 text-xs",
                  d.severity === "error"
                    ? "border border-red-200 bg-red-50 text-red-700"
                    : "border border-amber-200 bg-amber-50 text-amber-700",
                )}>
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
                    className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    {getActionLabel(action)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="h-8 flex-1 gap-1 text-xs"
                disabled={
                  isSending || agentPanel.isLoading || hasBlockingDiagnostics
                }
                size="sm"
                variant="default"
                onClick={handleApply}>
                <Check className="h-3.5 w-3.5" />
                {t("canvas.agentPanel.apply")}
              </Button>
              <Button
                className="h-8 flex-1 gap-1 text-xs"
                disabled={isSending || agentPanel.isLoading}
                size="sm"
                variant="outline"
                onClick={handleDiscard}>
                <Trash2 className="h-3.5 w-3.5" />
                {t("canvas.agentPanel.discard")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {needsRuntimeSetup && (
        <div className="border-t bg-amber-50/70">
          <div className="flex items-center gap-2 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{t("canvas.agentPanel.runtimeNotConfigured")}</span>
            <a
              className="font-medium underline underline-offset-2"
              href="/runtimes">
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
          onClick={handleSendClick}>
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
