import { Brain, CircleAlert, Gauge, RotateCw, Terminal, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { AgentActivityEntry } from "./agentActivity";

const iconByKind = {
  status: Terminal,
  thinking: Brain,
  tool: Wrench,
  diagnostic: CircleAlert,
  retry: RotateCw,
  usage: Gauge,
  terminal: Terminal,
} as const;

export const AgentActivityFeed = ({
  entries,
  active = false,
  className,
}: {
  entries: readonly AgentActivityEntry[];
  active?: boolean;
  className?: string;
}) => {
  const { t } = useTranslation();
  if (entries.length === 0) return null;

  return (
    <div
      className={cn("rounded-lg border border-border/80 bg-surface-2/45 p-2.5", className)}
      data-testid="agent-activity-feed"
    >
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{t("agentActivity.title")}</span>
        {active && <span className="size-1.5 animate-pulse rounded-full bg-success" />}
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {entries.map((entry) => {
          const Icon = iconByKind[entry.kind];

          return (
            <div key={entry.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-1.5 text-xs">
              <Icon className="mt-0.5 size-3 text-muted-foreground" />
              <div className="min-w-0">
                <div className="break-words text-[11px] font-medium text-foreground">
                  {entry.title}
                </div>
                {entry.detail && (
                  <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans text-[10.5px] leading-4 text-muted-foreground">
                    {entry.detail}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
