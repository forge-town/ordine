import { useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { AgentContextPayload } from "@repo/schemas";
import { Icon } from "@/components/primitives";

export type ContextStripProps = {
  /** buildAgentContext 输出——与实际发送给 proposeActions 的是同一对象（N12-01）。 */
  context: AgentContextPayload;
};

type ContextItem = {
  dim?: boolean;
  hot?: boolean;
  id: string;
  label: string;
  on: boolean;
  rule: string;
};

const LIVE_RUN_STATUSES = new Set(["queued", "running"]);

/**
 * Spec §3.3 context transparency。每一项的亮灭/计数完全由 payload 驱动，
 * Strip 不再自行编一套"注入规则"（假透明，N12-01 修正）。
 */
export const ContextStrip = ({ context }: ContextStripProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const running = Boolean(context.runState && LIVE_RUN_STATUSES.has(context.runState.status));
  const selectionLabel = context.selection
    .map((item) => item.label ?? item.refId)
    .join(", ");
  const anchorCount = context.anchors.reduce((total, anchor) => total + anchor.count, 0);
  const trackedNodeCount = context.runState
    ? Object.values(context.runState.nodeStatuses).filter((status) => status !== "idle").length
    : 0;

  const items: ContextItem[] = [
    {
      id: "project",
      label: t("workspace.agentBar.context.items.project"),
      on: Boolean(context.project),
      rule: t("workspace.agentBar.context.rules.always"),
    },
    {
      dim: running,
      id: "snapshot",
      label: t("workspace.agentBar.context.items.snapshot"),
      on: context.snapshotIncluded,
      rule: t("workspace.agentBar.context.rules.always"),
    },
    {
      id: "thread",
      label: t("workspace.agentBar.context.items.thread"),
      on: context.threadWindow.enabled,
      rule: t("workspace.agentBar.context.rules.windowed"),
    },
    {
      id: "selection",
      label:
        context.selection.length > 0
          ? t("workspace.agentBar.context.items.selectionWith", { refs: selectionLabel })
          : t("workspace.agentBar.context.items.selection"),
      on: context.selection.length > 0,
      rule: t("workspace.agentBar.context.rules.whenSelected"),
    },
    {
      id: "annotations",
      label:
        anchorCount > 0
          ? t("workspace.agentBar.context.items.annotationsWith", { count: anchorCount })
          : t("workspace.agentBar.context.items.annotations"),
      on: anchorCount > 0,
      rule: t("workspace.agentBar.context.rules.whenPresent"),
    },
    {
      hot: running,
      id: "runState",
      label: t("workspace.agentBar.context.items.runState"),
      on: Boolean(context.runState),
      rule: t("workspace.agentBar.context.rules.runtime"),
    },
    {
      hot: running,
      id: "nodeRuntime",
      label: t("workspace.agentBar.context.items.nodeRuntime"),
      on: trackedNodeCount > 0,
      rule: t("workspace.agentBar.context.rules.runtime"),
    },
    {
      dim: true,
      id: "memory",
      label: t("workspace.agentBar.context.items.memory"),
      on: Boolean(context.memory),
      rule: t("workspace.agentBar.context.rules.notImplemented"),
    },
  ];
  const activeCount = items.filter((item) => item.on).length;
  const summary = running
    ? t("workspace.agentBar.context.summary.running")
    : context.selection.length > 0
      ? t("workspace.agentBar.context.summary.selection")
      : anchorCount > 0
        ? t("workspace.agentBar.context.summary.annotations")
        : t("workspace.agentBar.context.summary.default");

  return (
    <div className="px-3 pt-2" data-testid="agent-context-strip">
      <button
        className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[10px] text-muted-foreground transition-colors hover:bg-accent/50"
        data-testid="agent-context-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon icon={Layers} size={11} />
        <span className="font-medium">{t("workspace.agentBar.context.title")}</span>
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9px]">
          {t("workspace.agentBar.context.itemCount", { count: activeCount })}
        </span>
        <span className="truncate text-foreground/45">{summary}</span>
        <Icon className="ml-auto shrink-0" icon={open ? ChevronDown : ChevronUp} size={11} />
      </button>
      {open ? (
        <div
          className="mt-1 space-y-0.5 rounded-xl bg-surface-2 p-2 ring-1 ring-border"
          data-testid="agent-context-items"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-1.5 py-1 text-[10.5px]",
                !item.on && "opacity-40",
              )}
              data-context-on={item.on ? "true" : "false"}
              data-testid={`agent-context-item-${item.id}`}
            >
              <span className="flex size-3 items-center justify-center">
                {item.on ? (
                  <span
                    className={cn(
                      "size-[7px] rounded-full",
                      item.hot ? "bg-foreground" : item.dim ? "bg-foreground/35" : "bg-success",
                    )}
                  />
                ) : (
                  <span className="size-[7px] rounded-full ring-1 ring-inset ring-border-strong" />
                )}
              </span>
              <span
                className={cn(
                  "flex-1 truncate",
                  item.hot ? "font-medium text-foreground" : "text-foreground/80",
                )}
              >
                {item.label}
              </span>
              <span className="shrink-0 font-mono text-[9px] text-muted-foreground/70">
                {item.rule}
              </span>
            </div>
          ))}
          <div className="px-1.5 pt-1 text-[9px] leading-snug text-muted-foreground/70">
            {running
              ? t("workspace.agentBar.context.footer.running")
              : t("workspace.agentBar.context.footer.editing")}
          </div>
        </div>
      ) : null}
    </div>
  );
};
