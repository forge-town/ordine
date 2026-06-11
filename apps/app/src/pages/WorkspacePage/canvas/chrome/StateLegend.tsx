import { CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import type { NodeRunStatus } from "@repo/schemas";

type LegendTone = "err" | "fg" | "neutral" | "ok" | "warn";

const STATE_DEFS: ReadonlyArray<readonly [NodeRunStatus, LegendTone]> = [
  ["idle", "neutral"],
  ["queued", "neutral"],
  ["running", "fg"],
  ["retrying", "warn"],
  ["waitingForUser", "warn"],
  ["done", "ok"],
  ["failed", "err"],
  ["skipped", "neutral"],
  ["cancelled", "neutral"],
];

const TONE_CLASS: Record<Exclude<LegendTone, "neutral">, string> = {
  err: "bg-destructive",
  fg: "bg-foreground",
  ok: "bg-success",
  warn: "bg-warning",
};

export const StateLegend = () => {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger
        className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-foreground shadow-soft ring-1 ring-border transition-colors hover:ring-border-strong data-[popup-open]:bg-foreground data-[popup-open]:text-background"
        data-testid="canvas-v2-state-legend-trigger"
      >
        <CircleDashed className="size-3.5" />
        {t("workspace.canvas.chrome.states.trigger")}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 rounded-2xl p-2.5" sideOffset={8}>
        <div
          className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          data-testid="canvas-v2-state-legend"
        >
          {t("workspace.canvas.chrome.states.title")}
        </div>
        <div className="space-y-0.5">
          {STATE_DEFS.map(([status, tone]) => (
            <div className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs" key={status}>
              <span className="relative inline-flex size-2 items-center justify-center">
                {tone === "neutral" ? (
                  <span className="size-2 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--color-muted-foreground)]" />
                ) : (
                  <span className={`size-2 rounded-full ${TONE_CLASS[tone]}`} />
                )}
              </span>
              <span className="flex-1">{t(`workspace.canvas.chrome.states.${status}`)}</span>
              <span className="font-mono text-[9px] text-muted-foreground/70">{status}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
