import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type BarRowTone = "default" | "fg";

export type BarRowProps = {
  className?: string;
  label: ReactNode;
  pct: number;
  sub?: ReactNode;
  tone?: BarRowTone;
  value: ReactNode;
};

export const BarRow = ({ className, label, pct, sub, tone = "default", value }: BarRowProps) => {
  const width = `${Math.min(100, Math.max(0, pct))}%`;

  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <div className="w-40 shrink-0 truncate text-[12.5px] font-medium">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            "h-2 rounded-full",
            tone === "fg" ? "bg-foreground/80" : "bg-foreground/35",
          )}
          style={{ width }}
        />
      </div>
      <div className="w-28 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
        {value}
      </div>
      {sub ? (
        <div className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/70">
          {sub}
        </div>
      ) : null}
    </div>
  );
};
