import { useEffect, useMemo, useRef } from "react";
import type { WorkspacePhase } from "@repo/schemas";
import { ChevronsRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasPageStore } from "@/pages/CanvasPage/_store";
import { Assistant, Bubble, ProposalCard } from "./messages";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { AgentBody } from "./AgentBody";
import { AgentDistillCard } from "./AgentDistillCard";
import { AgentRunCards } from "./AgentRunCards";
import { Composer } from "./Composer";
import { useAgentBarStore } from "./_store";
import { useAgentConversation } from "./useAgentConversation";

export const WORKSPACE_PHASES: WorkspacePhase[] = [
  "empty",
  "reversing",
  "clarify",
  "proposal",
  "applied",
  "running",
  "done",
];

export type AgentBarProps = {
  className?: string;
  composer?: React.ReactNode;
  onCollapse: () => void;
  pipelineId: string;
};

export const AgentBar = ({ className, composer, onCollapse, pipelineId }: AgentBarProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasStore = useCanvasPageStore();
  const activeJobId = useStore(canvasStore, (state) => state.activeJobId);
  const phase = useWorkspaceStore((state) => state.phase);
  const setPhase = useWorkspaceStore((state) => state.setPhase);
  const canvasRefs = useWorkspaceStore((state) => state.canvasRefs);
  const dismissed = useWorkspaceStore((state) => state.dismissed);
  const dismissRef = useWorkspaceStore((state) => state.dismiss);
  const messages = useAgentBarStore((state) => state.messages);
  const focusComposer = useWorkspaceStore((state) => state.focusComposer);
  const pendingAsk = useWorkspaceStore((state) => state.pendingAsk);
  const clearPendingAsk = useWorkspaceStore((state) => state.clearPendingAsk);
  const {
    applyProposal,
    diagnostics,
    hasBlockingDiagnostics,
    isReversing,
    isSending,
    pendingProposal,
    proposalItems,
    rejectProposal,
    reviseProposal,
    submitMessage,
  } = useAgentConversation({ phase, pipelineId });
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
  }, [messages.length, phase]);

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

      {import.meta.env.DEV ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 px-3 py-2">
          {WORKSPACE_PHASES.map((targetPhase) => (
            <Button
              className="h-7 shrink-0 rounded-full px-2 text-[10.5px]"
              key={targetPhase}
              size="sm"
              variant={targetPhase === phase ? "secondary" : "ghost"}
              onClick={() => setPhase(targetPhase)}
            >
              {targetPhase}
            </Button>
          ))}
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3">
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
        {messages.map((message) =>
          message.role === "user" ? (
            <Bubble
              attachmentLabel={message.metadata?.attachments?.map((item) => item.name).join(", ")}
              key={message.id}
            >
              {message.content}
            </Bubble>
          ) : (
            <Assistant isThinking={message.isThinking} key={message.id}>
              {message.content}
            </Assistant>
          ),
        )}
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
            onReject={rejectProposal}
            onRevise={reviseProposal}
          />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border/70">
        {composer ?? (
          <Composer
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
