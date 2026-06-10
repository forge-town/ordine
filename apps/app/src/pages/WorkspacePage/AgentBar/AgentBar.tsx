import { useEffect, useMemo, useRef } from "react";
import type { WorkspacePhase } from "@repo/schemas";
import { ChevronsRight, Eraser, Sparkles } from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Bubble, Assistant } from "./messages";
import { Icon, StatusPill, Tag } from "@/components/primitives";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { AgentBody } from "./AgentBody";
import { useAgentBarStore } from "./_store";

export const WORKSPACE_PHASES: WorkspacePhase[] = [
  "empty",
  "clarify",
  "proposal",
  "applied",
  "running",
  "done",
];

const phaseSubtitle: Record<WorkspacePhase, string> = {
  empty: "New canvas - no pipeline yet",
  clarify: "Reading goal and context",
  proposal: "Drafting - 5 nodes proposed",
  applied: "Reading canvas - 5 nodes",
  running: "Watching job_8f2a live",
  done: "Run complete - asset saved",
};

const phaseStatus = (phase: WorkspacePhase) =>
  phase === "done" ? "done" : phase === "running" ? "running" : "idle";

export type AgentBarProps = {
  className?: string;
  composer?: React.ReactNode;
  onCollapse: () => void;
  pipelineId: string;
};

export const AgentBar = ({ className, composer, onCollapse, pipelineId }: AgentBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const phase = useWorkspaceStore((state) => state.phase);
  const setPhase = useWorkspaceStore((state) => state.setPhase);
  const canvasRefs = useWorkspaceStore((state) => state.canvasRefs);
  const dismissed = useWorkspaceStore((state) => state.dismissed);
  const messages = useAgentBarStore((state) => state.messages);
  const clearMessages = useAgentBarStore((state) => state.clearMessages);
  const activeRefs = useMemo(
    () => canvasRefs.filter((ref) => !dismissed.includes(ref.id)),
    [canvasRefs, dismissed],
  );
  const subtitle =
    activeRefs.length > 0
      ? `${activeRefs.length} reference${activeRefs.length > 1 ? "s" : ""} selected`
      : phaseSubtitle[phase];
  const handlePhaseChange = (targetPhase: WorkspacePhase) => setPhase(targetPhase);
  const handleClearClick = () => clearMessages();
  const handleCollapseClick = () => onCollapse();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, phase]);

  return (
    <aside
      className={cn("flex h-full w-full flex-col bg-surface", className)}
      data-testid="workspace-agent-bar"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-primary-foreground">
          <Icon icon={Sparkles} size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight">Agent Bar</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <StatusPill status={phaseStatus(phase)} />
            <span className="truncate text-[10.5px] text-muted-foreground">{subtitle}</span>
          </div>
        </div>
        {messages.length > 0 ? (
          <Button
            aria-label="Clear conversation"
            className="h-8 w-8"
            size="icon"
            variant="ghost"
            onClick={handleClearClick}
          >
            <Eraser className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          aria-label="Collapse Agent Bar"
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleCollapseClick}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </header>

      {import.meta.env.DEV ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 px-3 py-2">
          {WORKSPACE_PHASES.map((targetPhase) => {
            const handlePhaseClick = () => setPhase(targetPhase);

            return (
              <Button
                key={targetPhase}
                className="h-7 shrink-0 rounded-full px-2 text-[10.5px]"
                size="sm"
                variant={targetPhase === phase ? "secondary" : "ghost"}
                onClick={handlePhaseClick}
              >
                {targetPhase}
              </Button>
            );
          })}
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3">
        <AgentBody phase={phase} onPhaseChange={handlePhaseChange} />
        {messages.map((message) =>
          message.role === "user" ? (
            <Bubble key={message.id}>{message.content}</Bubble>
          ) : (
            <Assistant key={message.id} isThinking={message.isThinking}>
              {message.content}
            </Assistant>
          ),
        )}
      </div>

      <div className="shrink-0 border-t border-border/70">
        <div className="px-3 pt-2">
          <div className="flex flex-wrap gap-1.5">
            <Tag>{pipelineId}</Tag>
            <Tag>{phase}</Tag>
            {activeRefs.map((ref) => (
              <Tag key={ref.id}>{ref.label}</Tag>
            ))}
          </div>
        </div>
        {composer ?? (
          <div className="p-3">
            <div className="rounded-2xl bg-background px-3 py-2 text-[12px] text-muted-foreground ring-1 ring-border">
              Composer
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
