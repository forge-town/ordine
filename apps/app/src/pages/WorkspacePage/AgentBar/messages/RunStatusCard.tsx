import { Dot } from "@/components/primitives";

export type RunStatusCardProps = {
  costLabel?: string;
  isLive?: boolean;
  subtitle: string;
  title: string;
};

/** Minimal run line — `job_x · step 3/5 · 14.6s · $0.14`. */
export const RunStatusCard = ({
  costLabel,
  isLive = true,
  subtitle,
  title,
}: RunStatusCardProps) => (
  <div
    className="flex items-center gap-2 text-[11px] text-muted-foreground"
    data-testid="agent-run-status"
  >
    <Dot ping={isLive} tone={isLive ? "muted" : "success"} />
    <span className="shrink-0 font-mono">{title}</span>
    <span className="truncate">· {subtitle}</span>
    {costLabel ? (
      <span className="shrink-0 font-mono tabular-nums">· {costLabel}</span>
    ) : null}
  </div>
);
