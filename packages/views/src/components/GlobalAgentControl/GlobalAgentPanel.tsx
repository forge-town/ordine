import { FormEvent, KeyboardEvent, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  LoaderCircle,
  Send,
  Square,
  Undo2,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Textarea } from "@repo/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { AgentApprovalCard } from "./AgentApprovalCard";
import { AgentContextChips } from "./AgentContextChips";
import { useAgentControl } from "./GlobalAgentControlProvider";

const isCanvasChangeSetVisible = (status: string) =>
  status === "drafting" || status === "ready" || status === "conflicted";

export const GlobalAgentPanel = ({ className }: { className?: string }) => {
  const capabilities = useAgentControl((state) => state.capabilities);
  const threads = useAgentControl((state) => state.threads);
  const activeThreadId = useAgentControl((state) => state.activeThreadId);
  const messages = useAgentControl((state) => state.messages);
  const actions = useAgentControl((state) => state.actions);
  const approvals = useAgentControl((state) => state.approvals);
  const changeSets = useAgentControl((state) => state.changeSets);
  const draft = useAgentControl((state) => state.draft);
  const streamingText = useAgentControl((state) => state.streamingText);
  const isRunning = useAgentControl((state) => state.isRunning);
  const isBootstrapping = useAgentControl((state) => state.isBootstrapping);
  const selectedRuntimeId = useAgentControl((state) => state.selectedRuntimeId);
  const error = useAgentControl((state) => state.error);
  const setDraft = useAgentControl((state) => state.setDraft);
  const selectThread = useAgentControl((state) => state.selectThread);
  const setRuntime = useAgentControl((state) => state.setSelectedRuntimeId);
  const submit = useAgentControl((state) => state.submit);
  const stop = useAgentControl((state) => state.stop);
  const applyChangeSet = useAgentControl((state) => state.applyChangeSet);
  const rejectChangeSet = useAgentControl((state) => state.rejectChangeSet);
  const supportedRuntimes = capabilities?.runtimes.filter((runtime) => runtime.supported) ?? [];
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const visibleChangeSets = changeSets.filter((changeSet) =>
    isCanvasChangeSetVisible(changeSet.status),
  );
  const recentActions = useMemo(() => [...actions].slice(-20).reverse(), [actions]);
  const disabled = !capabilities?.enabled || supportedRuntimes.length === 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <section
      className={cn("flex h-full min-h-0 flex-col bg-surface", className)}
      data-testid="global-agent-panel"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <CircleDot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">ORDINE Agent</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {isRunning
              ? "Working through controlled tools…"
              : `${capabilities?.toolCount ?? 22} controlled tools`}
          </p>
        </div>
        {threads.length > 0 && (
          <select
            aria-label="Agent thread"
            className="h-7 max-w-32 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-ring"
            value={activeThreadId ?? ""}
            onChange={(event) => void selectThread(event.target.value)}
          >
            {threads.map((thread) => (
              <option key={thread.id} value={thread.id}>
                {thread.title}
              </option>
            ))}
          </select>
        )}
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {!isBootstrapping && !capabilities?.enabled && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Agent Control is disabled by ORDINE_AGENT_CONTROL_ENABLED=false.
            </div>
          )}
          {!isBootstrapping && capabilities?.enabled && supportedRuntimes.length === 0 && (
            <div className="rounded-xl border border-warning/35 bg-warning/5 p-3 text-xs text-muted-foreground">
              No installed runtime has passed MCP-only control-mode isolation. ORDINE will not fall
              back to the legacy JSON planner.
            </div>
          )}

          {messages.map((message) => (
            <article
              className={cn(
                "max-w-[92%] rounded-2xl px-3 py-2 text-sm",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto border border-border bg-background text-foreground",
              )}
              key={message.id}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </article>
          ))}
          {streamingText && (
            <article className="mr-auto max-w-[92%] rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground">
              <p className="whitespace-pre-wrap break-words">{streamingText}</p>
            </article>
          )}

          {pendingApprovals.map((approval) => (
            <AgentApprovalCard approval={approval} key={approval.id} />
          ))}

          {visibleChangeSets.map((changeSet) => (
            <article
              className="rounded-xl border border-primary/25 bg-primary/5 p-3"
              key={changeSet.id}
            >
              <div className="flex items-start gap-2">
                <Undo2 className="mt-0.5 size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">Canvas Change Set</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {changeSet.revision} action(s) · {changeSet.status}
                  </p>
                  {changeSet.status === "ready" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void applyChangeSet(changeSet.id, changeSet.baseVersion)}
                      >
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void rejectChangeSet(changeSet.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}

          {recentActions.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Activity
              </p>
              {recentActions.map((action) => (
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
                  key={action.id}
                >
                  {action.status === "succeeded" || action.status === "replayed" ? (
                    <CheckCircle2 className="size-3.5 text-success" />
                  ) : action.status === "failed" ? (
                    <AlertCircle className="size-3.5 text-destructive" />
                  ) : (
                    <LoaderCircle className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{action.toolName}</span>
                  <span className="text-[10px] text-muted-foreground">{action.status}</span>
                </div>
              ))}
            </div>
          )}
          {messages.length === 0 && recentActions.length === 0 && capabilities?.enabled && (
            <div className="grid min-h-52 place-items-center px-6 text-center">
              <div>
                <CircleDot className="mx-auto size-7 text-primary" />
                <p className="mt-3 text-sm font-medium">Control ORDINE step by step</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  The Agent reads only the context it needs and applies small, observable tool
                  actions.
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form className="shrink-0 space-y-2 border-t border-border p-3" onSubmit={handleSubmit}>
        <AgentContextChips />
        <Textarea
          aria-label="Message ORDINE Agent"
          className="min-h-20 resize-none"
          disabled={disabled}
          placeholder="Ask ORDINE to create, edit, run, or inspect…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center gap-2">
          <select
            aria-label="Control runtime"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-ring"
            disabled={supportedRuntimes.length === 0 || isRunning}
            value={selectedRuntimeId ?? ""}
            onChange={(event) => setRuntime(event.target.value)}
          >
            {supportedRuntimes.map((runtime) => (
              <option key={runtime.runtimeConfigId} value={runtime.runtimeConfigId}>
                {runtime.name}
              </option>
            ))}
          </select>
          {isRunning ? (
            <Button
              aria-label="Stop Agent"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => void stop()}
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              aria-label="Send to Agent"
              disabled={disabled || !draft.trim()}
              size="icon"
              type="submit"
            >
              <Send />
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </section>
  );
};
