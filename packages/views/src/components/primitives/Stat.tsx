import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type StatTone = "default" | "error" | "success";

export type StatProps = {
  className?: string;
  label: ReactNode;
  secondary?: ReactNode;
  tone?: StatTone;
  value: ReactNode;
};

const valueToneClassName: Record<StatTone, string> = {
  default: "text-foreground",
  error: "text-destructive",
  success: "text-success",
};

export const Stat = ({ className, label, secondary, tone = "default", value }: StatProps) => (
  <div className={cn("rounded-lg bg-surface p-4 shadow-soft ring-1 ring-border", className)}>
    <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
    <div className={cn("mt-1.5 text-2xl font-semibold leading-none", valueToneClassName[tone])}>
      {value}
    </div>
    {secondary ? <div className="mt-1.5 text-xs text-muted-foreground">{secondary}</div> : null}
  </div>
);
