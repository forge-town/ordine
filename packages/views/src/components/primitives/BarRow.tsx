import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type BarRowTone = "default" | "foreground";

export type BarRowProps = {
  className?: string;
  label: ReactNode;
  percent: number;
  secondaryValue?: ReactNode;
  tone?: BarRowTone;
  value: ReactNode;
};

export const BarRow = ({
  className,
  label,
  percent,
  secondaryValue,
  tone = "default",
  value,
}: BarRowProps) => {
  const boundedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(5rem,10rem)_minmax(4rem,1fr)_auto] items-center gap-3 py-2",
        className,
      )}
    >
      <div className="truncate text-xs font-medium">{label}</div>
      <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={boundedPercent}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
      >
        <div
          className={cn(
            "h-full rounded-full",
            tone === "foreground" ? "bg-foreground/80" : "bg-foreground/35",
          )}
          style={{ width: `${boundedPercent}%` }}
        />
      </div>
      <div className="flex shrink-0 items-baseline gap-2 text-right text-xs tabular-nums text-muted-foreground">
        <span>{value}</span>
        {secondaryValue ? (
          <span className="text-[11px] text-muted-foreground/70">{secondaryValue}</span>
        ) : null}
      </div>
    </div>
  );
};
