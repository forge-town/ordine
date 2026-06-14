import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type StatTone = "default" | "success" | "error";

export type StatProps = {
  className?: string;
  label: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  value: ReactNode;
};

const valueToneClassName: Record<StatTone, string> = {
  default: "text-foreground",
  success: "text-success",
  error: "text-destructive",
};

export const Stat = ({ className, label, sub, tone = "default", value }: StatProps) => {
  return (
    <div className={cn("rounded-2xl bg-surface p-4 ring-1 ring-border shadow-soft", className)}>
      <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn("mt-1.5 text-[24px] font-semibold leading-none", valueToneClassName[tone])}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[11.5px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
};
