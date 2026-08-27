import { FormEvent, KeyboardEvent, useEffect, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock3,
  LoaderCircle,
  MessageSquareText,
  Send,
  Square,
  Undo2,
} from "lucide-react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Textarea } from "@repo/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { usePlatform } from "../../platform";
import { AgentExecutionPicker, useAgentExecutionChoice } from "../AgentExecutionPicker";
import { AgentActivitySurface } from "../AgentActivity";
import { AgentApprovalCard } from "./AgentApprovalCard";
import { AgentContextChips } from "./AgentContextChips";
import { useAgentControl } from "./GlobalAgentControlProvider";

const isCanvasChangeSetVisible = (status: string) =>
  status === "drafting" || status === "ready" || status === "conflicted";

export const GlobalAgentPanel = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const platform = usePlatform();
  const capabilities = useAgentControl((state) => state.capabilities);
  const storedExecutionChoice = useAgentControl((state) => state.executionChoice);
  const threads = useAgentControl((state) => state.threads);
  const activeThreadId = useAgentControl((state) => state.activeThreadId);
  const currentRunId = useAgentControl((state) => state.currentRunId);
  const messages = useAgentControl((state) => state.messages);
  const events = useAgentControl((state) => state.events);
  const actions = useAgentControl((state) => state.actions);
  const approvals = useAgentControl((state) => state.approvals);
  const changeSets = useAgentControl((state) => state.changeSets);
  const draft = useAgentControl((state) => state.draft);
  const streamingText = useAgentControl((state) => state.streamingText);
  const isRunning = useAgentControl((state) => state.isRunning);
  const isBootstrapping = useAgentControl((state) => state.isBootstrapping);
  const error = useAgentControl((state) => state.error);
  const setDraft = useAgentControl((state) => state.setDraft);
  const setExecutionChoice = useAgentControl((state) => state.setExecutionChoice);
  const selectThread = useAgentControl((state) => state.selectThread);
  const submit = useAgentControl((state) => state.submit);
  const stop = useAgentControl((state) => state.stop);
  const applyChangeSet = useAgentControl((state) => state.applyChangeSet);
  const rejectChangeSet = useAgentControl((state) => state.rejectChangeSet);
  const supportedRuntimes = capabilities?.runtimes.filter((runtime) => runtime.supported) ?? [];
  const preferredRuntimeId = supportedRuntimes[0]?.runtimeConfigId ?? null;
  const {
    catalog: executionCatalog,
    choice: executionChoice,
    isLoading: isExecutionChoiceLoading,
    persistChoice,
    selectRuntime,
  } = useAgentExecutionChoice({ requestedRuntimeConfigId: preferredRuntimeId });
  const runtimeDisabledReasons = useMemo(
    () =>
      Object.fromEntries(
        executionCatalog.flatMap((entry) => {
          if (!entry.runtimeConfigId) return [];
          const capability = capabilities?.runtimes.find(
            (runtime) => runtime.runtimeConfigId === entry.runtimeConfigId,
          );

          return capability?.supported
            ? []
            : [
                [
                  entry.runtimeConfigId,
                  capability?.reason ?? t("agentControl.runtimeUnavailable"),
                ] as const,
              ];
        }),
      ),
    [capabilities?.runtimes, executionCatalog, t],
  );
  const selectableExecutionChoice =
    executionChoice &&
    capabilities?.runtimes.some(
      (runtime) => runtime.runtimeConfigId === executionChoice.runtimeConfigId && runtime.supported,
    )
      ? executionChoice
      : storedExecutionChoice;
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const visibleChangeSets = changeSets.filter((changeSet) =>
    isCanvasChangeSetVisible(changeSet.status),
  );
  const recentActions = useMemo(() => [...actions].slice(-12).reverse(), [actions]);
  const recentRuntimeEvents = useMemo(
    () =>
      events
        .filter(({ event }) => event.type === "diagnostic" || event.type === "terminal")
        .slice(-6)
        .reverse(),
    [events],
  );
  const visibleRuntimeEvents = currentRunId ? [] : recentRuntimeEvents;
  const latestTerminalStatus = useMemo(() => {
    const latest = [...events].reverse().find(({ event }) => event.type === "terminal")?.event;

    return latest?.type === "terminal" ? latest.status : null;
  }, [events]);
  const disabled = !capabilities?.enabled || supportedRuntimes.length === 0;
  const statusLabel = error
    ? t("agentControl.status.failed")
    : isRunning
      ? t("agentControl.status.working")
      : latestTerminalStatus
        ? t(`agentControl.status.${latestTerminalStatus}`)
        : t("agentControl.status.ready");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };
  useEffect(() => {
    if (selectableExecutionChoice && selectableExecutionChoice !== storedExecutionChoice) {
      setExecutionChoice(selectableExecutionChoice);
    }
  }, [selectableExecutionChoice, setExecutionChoice, storedExecutionChoice]);
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
      <header className="shrink-0 space-y-3 border-b border-border py-3.5 pr-12 pl-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <CircleDot className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t("agentControl.title")}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isRunning
                ? t("agentControl.workingDescription")
                : t("agentControl.toolCount", { count: capabilities?.toolCount ?? 22 })}
            </p>
          </div>
          <Badge variant={error ? "destructive" : isRunning ? "secondary" : "outline"}>
            {isRunning && (
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                data-icon="inline-start"
              />
            )}
            {statusLabel}
          </Badge>
        </div>

        <div className="space-y-1" data-testid="agent-control-execution-picker">
          <AgentExecutionPicker
            catalog={executionCatalog}
            choice={selectableExecutionChoice}
            className="w-full justify-start border border-border bg-muted/35 px-2.5"
            disabled={isRunning}
            isolationDescription={t("agentControl.runtimeIsolation")}
            isLoading={isExecutionChoiceLoading}
            runtimeDisabledReasons={runtimeDisabledReasons}
            onChange={persistChoice}
            onRuntimeChange={selectRuntime}
          />
          <p className="px-1 text-[10px] leading-4 text-muted-foreground">
            {t("agentControl.runtimePicker")}
          </p>
        </div>

        {threads.length > 0 ? (
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("agentControl.thread.label")}
            </span>
            <select
              aria-label={t("agentControl.thread.label")}
              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:border-ring"
              value={activeThreadId ?? ""}
              onChange={(event) => {
                if (event.target.value) void selectThread(event.target.value);
              }}
            >
              <option disabled value="">
                {t("agentControl.thread.new")}
              </option>
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.title}
                  {thread.status === "archived" ? ` · ${t("agentControl.thread.archived")}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-[11px] text-muted-foreground">{t("agentControl.thread.empty")}</p>
        )}
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {!isBootstrapping && !capabilities?.enabled && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {t("agentControl.disabled")}
            </div>
          )}
          {!isBootstrapping && capabilities?.enabled && supportedRuntimes.length === 0 && (
            <div className="rounded-xl border border-warning/35 bg-warning/5 p-3 text-xs text-muted-foreground">
              {t("agentControl.unsupported")}
            </div>
          )}
          {error && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3"
              data-testid="agent-control-error"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-destructive">
                    {t("agentControl.failure.title")}
                  </p>
                  <p className="mt-1 break-words text-[11px] leading-4 text-muted-foreground">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentRunId && (
            <AgentActivitySurface platform={platform} runId={currentRunId} variant="panel" />
          )}

          {(messages.length > 0 || (streamingText && !currentRunId)) && (
            <div className="space-y-2.5" aria-label={t("agentControl.conversation.title")}>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageSquareText className="size-3" />
                {t("agentControl.conversation.title")}
              </div>
              {messages.map((message) => (
                <article
                  className={cn(
                    "rounded-2xl px-3 py-2.5 text-sm",
                    message.role === "user" &&
                      "ml-auto max-w-[88%] rounded-br-md bg-primary text-primary-foreground",
                    message.role === "assistant" &&
                      "mr-auto max-w-[92%] rounded-bl-md border border-border bg-background text-foreground",
                    message.role === "system" &&
                      "w-full rounded-lg border border-warning/25 bg-warning/5 text-foreground",
                  )}
                  key={message.id}
                >
                  <p
                    className={cn(
                      "mb-1 text-[10px] font-semibold uppercase tracking-wide",
                      message.role === "user"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground",
                    )}
                  >
                    {t(`agentControl.messageRole.${message.role}`)}
                  </p>
                  {message.role === "assistant" ? (
                    <div className="break-words leading-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5">
                      <Markdown>{message.content}</Markdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words leading-5">{message.content}</p>
                  )}
                </article>
              ))}
              {streamingText && !currentRunId && (
                <article className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {t("agentControl.messageRole.assistant")}
                  </p>
                  <p className="whitespace-pre-wrap break-words leading-5">{streamingText}</p>
                </article>
              )}
            </div>
          )}

          {pendingApprovals.map((approval) => (
            <AgentApprovalCard approval={approval} key={approval.id} />
          ))}

          {visibleChangeSets.map((changeSet) => (
            <article
              className="rounded-xl border border-primary/25 bg-primary/5 p-3"
              data-status={changeSet.status}
              data-testid="agent-change-set"
              key={changeSet.id}
            >
              <div className="flex items-start gap-2">
                <Undo2 className="mt-0.5 size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{t("agentControl.changeSet.title")}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("agentControl.changeSet.summary", {
                      count: changeSet.revision,
                      status: t(`agentControl.changeSet.status.${changeSet.status}`),
                    })}
                  </p>
                  {changeSet.status === "ready" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        data-testid="agent-change-set-apply"
                        size="sm"
                        onClick={() => void applyChangeSet(changeSet.id, changeSet.baseVersion)}
                      >
                        {t("agentControl.changeSet.apply")}
                      </Button>
                      <Button
                        data-testid="agent-change-set-reject"
                        size="sm"
                        variant="outline"
                        onClick={() => void rejectChangeSet(changeSet.id)}
                      >
                        {t("agentControl.changeSet.reject")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}

          {(visibleRuntimeEvents.length > 0 || recentActions.length > 0) && (
            <div className="space-y-1.5 border-t border-border pt-3" data-testid="agent-activity">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock3 className="size-3" />
                {t("agentControl.activity.title")}
              </p>
              {visibleRuntimeEvents.map((envelope) => {
                const runtimeEvent = envelope.event;
                if (runtimeEvent.type !== "diagnostic" && runtimeEvent.type !== "terminal") {
                  return null;
                }
                const failed =
                  runtimeEvent.type === "diagnostic"
                    ? runtimeEvent.level === "error"
                    : runtimeEvent.status !== "completed" && runtimeEvent.status !== "cancelled";

                return (
                  <div
                    className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 rounded-lg bg-muted/35 px-2 py-2 text-xs"
                    key={`${envelope.runId}:${envelope.sequence}`}
                  >
                    {failed ? (
                      <AlertCircle className="mt-0.5 size-3.5 text-destructive" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 size-3.5 text-success" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium">
                        {runtimeEvent.type === "diagnostic"
                          ? runtimeEvent.code
                          : t(`agentControl.status.${runtimeEvent.status}`)}
                      </p>
                      {runtimeEvent.type === "diagnostic" && (
                        <p className="mt-0.5 break-words text-[10px] leading-4 text-muted-foreground">
                          {runtimeEvent.message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {recentActions.map((action) => (
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
                  data-status={action.status}
                  data-testid="agent-action"
                  key={action.id}
                >
                  {action.status === "succeeded" || action.status === "replayed" ? (
                    <CheckCircle2 className="size-3.5 text-success" />
                  ) : action.status === "failed" ? (
                    <AlertCircle className="size-3.5 text-destructive" />
                  ) : (
                    <LoaderCircle className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                    {action.toolName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t(`agentControl.actionStatus.${action.status}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {messages.length === 0 &&
            recentActions.length === 0 &&
            visibleRuntimeEvents.length === 0 &&
            capabilities?.enabled && (
              <div className="grid min-h-52 place-items-center px-6 text-center">
                <div>
                  <CircleDot className="mx-auto size-7 text-primary" />
                  <p className="mt-3 text-sm font-medium">{t("agentControl.empty.title")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("agentControl.empty.description")}
                  </p>
                </div>
              </div>
            )}
        </div>
      </ScrollArea>

      <form className="shrink-0 space-y-2.5 border-t border-border p-3" onSubmit={handleSubmit}>
        <AgentContextChips />
        <Textarea
          aria-label={t("agentControl.composer.label")}
          className="min-h-24 resize-none rounded-xl"
          data-testid="agent-composer-input"
          disabled={disabled}
          placeholder={t("agentControl.composer.placeholder")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            {t("agentControl.composer.shortcut")}
          </span>
          {isRunning ? (
            <Button type="button" variant="outline" onClick={() => void stop()}>
              <Square className="size-3.5 fill-current" />
              {t("agentControl.composer.stop")}
            </Button>
          ) : (
            <Button
              data-testid="agent-composer-submit"
              disabled={disabled || !draft.trim()}
              type="submit"
            >
              <Send />
              {t("agentControl.composer.send")}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
};
