import { useEffect, useMemo, useRef } from "react";
import { useUpdate } from "@refinedev/core";
import { useNavigate } from "@tanstack/react-router";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { Check, ChevronsRight, MessageSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasStore } from "../canvas/_store/canvasStore";
import {
  Assistant,
  Bubble,
  ClarifyOptions,
  ErrorActions,
  MessageActions,
  ProposalCard,
} from "./messages";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { AgentBody } from "./AgentBody";
import { AgentDistillCard } from "./AgentDistillCard";
import { DebugPhaseBar } from "./DebugPhaseBar";
import { AgentRunCards } from "./AgentRunCards";
import { Composer, RefChips } from "./Composer";
import { useAgentBarStore, type AgentBarMessage } from "./_store";
import { useAgentConversation } from "./useAgentConversation";

export type AgentBarProps = {
  className?: string;
  composer?: React.ReactNode;
  onCollapse: () => void;
  pipelineId: string;
  pipelineName?: string;
};

export const AgentBar = ({
  className,
  composer,
  onCollapse,
  pipelineId,
  pipelineName,
}: AgentBarProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const canvasNodes = useCanvasStore((state) => state.nodes);
  const phase = useWorkspaceStore((state) => state.phase);
  const canvasRefs = useWorkspaceStore((state) => state.canvasRefs);
  const dismissed = useWorkspaceStore((state) => state.dismissed);
  const dismissRef = useWorkspaceStore((state) => state.dismiss);
  const thread = useWorkspaceStore((state) => state.thread);
  const setThread = useWorkspaceStore((state) => state.setThread);
  const messages = useAgentBarStore((state) => state.messages);
  const resolveMessage = useAgentBarStore((state) => state.resolveMessage);
  const { mutate: updateMessage } = useUpdate();
  const focusComposer = useWorkspaceStore((state) => state.focusComposer);
  const setComposerDraft = useWorkspaceStore((state) => state.setComposerDraft);
  const pendingAsk = useWorkspaceStore((state) => state.pendingAsk);
  const clearPendingAsk = useWorkspaceStore((state) => state.clearPendingAsk);
  const {
    agentContext,
    applyProposal,
    diagnostics,
    hasBlockingDiagnostics,
    isReversing,
    isSending,
    pendingProposal,
    proposalItems,
    rejectProposal,
    requestProposalFix,
    reviseProposal,
    submitMessage,
  } = useAgentConversation({ phase, pipelineId, pipelineName });
  const reversingSteps = useMemo(
    () =>
      ["structure", "steps", "matched", "draft"].map((step, index, all) => ({
        detail: t(`workspace.agentBar.reversing.steps.${step}Detail`),
        done: !isReversing || index < all.length - 1,
        id: step,
        title: t(`workspace.agentBar.reversing.steps.${step}`),
      })),
    [isReversing, t],
  );
  const activeRefs = useMemo(
    () => canvasRefs.filter((ref) => !dismissed.includes(ref.id)),
    [canvasRefs, dismissed],
  );
  const visibleMessages = useMemo(
    () =>
      thread
        ? messages.filter((message) =>
            (message.metadata?.referencedNodeIds ?? []).includes(thread.id),
          )
        : messages,
    [messages, thread],
  );
  const refsForMessage = (message: AgentBarMessage): WorkspaceCanvasRef[] => {
    const nodeLabelById = new Map(
      canvasNodes.map((node) => [node.id, node.data.label ?? node.id] as const),
    );

    return (message.metadata?.referencedNodeIds ?? []).map((refId) => {
      const path = refId.split("/");
      const baseId = path.at(-1) ?? refId;

      return {
        baseId,
        id: refId,
        kind: "node",
        label: nodeLabelById.get(baseId) ?? baseId,
        path: path.slice(0, -1),
        type: "node",
      };
    });
  };
  const handleResolveMessage = (message: AgentBarMessage) => {
    resolveMessage(message.id);
    updateMessage({
      errorNotification: false,
      id: message.id,
      resource: ResourceName.conversationMessages,
      successNotification: false,
      values: { metadata: { ...message.metadata, resolved: true } },
    });
  };
  const subtitle =
    activeRefs.length > 0
      ? t("workspace.agentBar.subtitle.refsSelected", { count: activeRefs.length })
      : phase === "running" && activeJobId
        ? t("workspace.agentBar.subtitle.watching", { jobId: activeJobId })
        : t(`workspace.agentBar.subtitle.${phase}`);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isSending, messages.length, phase]);

  useEffect(() => {
    if (!pendingAsk) {
      return;
    }
    void submitMessage({
      content: pendingAsk.text,
      metadata: { referencedNodeIds: [pendingAsk.ref.id] },
    });
    clearPendingAsk();
    // Consume each ask request exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk?.nonce]);

  return (
    <aside
      className={cn("flex h-full w-full flex-col bg-surface", className)}
      data-testid="workspace-agent-bar"
    >
      <header className="flex shrink-0 items-center justify-between px-3.5 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              phase === "running" ? "animate-pulse bg-foreground" : "bg-success",
            )}
            data-testid="agent-bar-status-dot"
          />
          <span className="text-[12px] font-semibold">{t("workspace.agentBar.title")}</span>
          <span className="truncate text-[10.5px] text-muted-foreground">· {subtitle}</span>
        </div>
        <Button
          aria-label={t("workspace.agentBar.collapse")}
          className="h-7 w-7 shrink-0"
          size="icon"
          variant="ghost"
          onClick={onCollapse}
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </header>

      <DebugPhaseBar />

      {thread ? (
        <div
          className="mx-3 mb-1 flex items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-1.5 ring-1 ring-border-strong"
          data-testid="agent-thread-banner"
        >
          <MessageSquare className="size-3 text-foreground/70" />
          <span className="min-w-0 flex-1 truncate text-[11px]">
            <span className="font-medium">{t("workspace.agentBar.thread.title")}</span> ·{" "}
            {thread.label}
          </span>
          <button
            className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            data-testid="agent-thread-show-all"
            type="button"
            onClick={() => setThread(null)}
          >
            <X className="size-3" />
            {t("workspace.agentBar.thread.showAll")}
          </button>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3">
        {thread && visibleMessages.length === 0 ? (
          <div className="grid place-items-center py-10 text-center">
            <MessageSquare className="size-5 text-muted-foreground/50" />
            <div className="mt-2 text-[12px] font-medium">
              {t("workspace.agentBar.thread.emptyTitle")}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {t("workspace.agentBar.thread.emptyBody")}
            </div>
          </div>
        ) : null}
        {!thread ? (
          <AgentBody
            distillContent={
              phase === "done" ? <AgentDistillCard pipelineId={pipelineId} /> : undefined
            }
            phase={phase}
            reversingSteps={phase === "reversing" ? reversingSteps : undefined}
            runContent={phase === "running" ? <AgentRunCards /> : undefined}
            onSuggestGoal={(goal) =>
              void submitMessage({ content: goal, metadata: { referencedNodeIds: [] } })
            }
            onSuggestReverse={focusComposer}
          />
        ) : null}
        {visibleMessages.map((message) => {
          const messageRefs = refsForMessage(message);
          const resolvable = thread && !message.metadata?.resolved && !message.isThinking;
          const clarifyOptions = message.metadata?.clarifyOptions ?? [];
          const isLastMessage = message.id === visibleMessages.at(-1)?.id;
          const showClarifyOptions =
            message.role === "assistant" &&
            clarifyOptions.length > 0 &&
            isLastMessage &&
            !pendingProposal;
          const errorCode = message.metadata?.proposeErrorCode;
          const showErrorActions =
            message.role === "assistant" && Boolean(errorCode) && isLastMessage;
          const handleErrorRetry = () => {
            const messageIndex = visibleMessages.indexOf(message);
            const lastUserMessage = [...visibleMessages.slice(0, messageIndex)]
              .reverse()
              .find((candidate) => candidate.role === "user");
            if (!lastUserMessage) {
              return;
            }
            void submitMessage({
              content: lastUserMessage.content,
              metadata: {
                referencedNodeIds: lastUserMessage.metadata?.referencedNodeIds ?? [],
              },
            });
          };
          const handleEditMessage = () => setComposerDraft(message.content);
          const handleRetryMessage = () =>
            void submitMessage({
              content: message.content,
              metadata: {
                referencedNodeIds: message.metadata?.referencedNodeIds ?? [],
              },
            });
          const body =
            message.role === "user" ? (
              <Bubble
                attachmentLabel={message.metadata?.attachments?.map((item) => item.name).join(", ")}
              >
                {message.content}
              </Bubble>
            ) : (
              <Assistant isThinking={message.isThinking}>{message.content}</Assistant>
            );

          return (
            <div key={message.id} className="group/turn relative space-y-1">
              {body}
              {!message.isThinking && message.content.trim().length > 0 ? (
                <MessageActions
                  align={message.role === "user" ? "right" : "left"}
                  content={message.content}
                  disabled={isSending}
                  onEdit={message.role === "user" ? handleEditMessage : undefined}
                  onRetry={message.role === "user" ? handleRetryMessage : undefined}
                />
              ) : null}
              {messageRefs.length > 0 ? (
                <div className={cn(message.role === "user" && "flex justify-end")}>
                  <RefChips small refs={messageRefs} />
                </div>
              ) : null}
              {showClarifyOptions ? (
                <ClarifyOptions
                  disabled={isSending}
                  options={clarifyOptions}
                  onSelect={(option) =>
                    void submitMessage({ content: option, metadata: { referencedNodeIds: [] } })
                  }
                />
              ) : null}
              {showErrorActions && errorCode ? (
                <ErrorActions
                  code={errorCode}
                  disabled={isSending}
                  onOpenSettings={() => void navigate({ to: "/settings" })}
                  onRetry={handleErrorRetry}
                />
              ) : null}
              {resolvable ? (
                <button
                  aria-label={t("workspace.agentBar.thread.resolve")}
                  className="absolute -left-3 top-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/turn:opacity-100"
                  data-testid={`agent-resolve-${message.id}`}
                  title={t("workspace.agentBar.thread.resolve")}
                  type="button"
                  onClick={() => handleResolveMessage(message)}
                >
                  <Check className="size-3" />
                </button>
              ) : null}
            </div>
          );
        })}
        {isSending ? (
          <Assistant isThinking>{t("workspace.agentBar.thinking")}</Assistant>
        ) : null}
        {diagnostics && diagnostics.length > 0 ? (
          <Assistant>{diagnostics.map((diagnostic) => diagnostic.message).join(" ")}</Assistant>
        ) : null}
        {pendingProposal ? (
          <ProposalCard
            items={proposalItems}
            subtitle={
              hasBlockingDiagnostics
                ? t("workspace.agentBar.proposal.blocked")
                : t("workspace.agentBar.proposal.actionCount", {
                    count: pendingProposal.actions.length,
                  })
            }
            title={pendingProposal.summary}
            onApply={applyProposal}
            onAskFix={hasBlockingDiagnostics ? () => void requestProposalFix() : undefined}
            onReject={rejectProposal}
            onRevise={reviseProposal}
          />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border/70">
        {composer ?? (
          <Composer
            agentContext={agentContext}
            isSending={isSending}
            refs={activeRefs}
            onRemoveRef={dismissRef}
            onSubmit={submitMessage}
          />
        )}
      </div>
    </aside>
  );
};
