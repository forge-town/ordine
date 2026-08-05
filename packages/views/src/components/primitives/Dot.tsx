import { cn } from "@repo/ui/lib/utils";

export type DotTone = "error" | "muted" | "success" | "warning";

export type DotProps = {
  className?: string;
  ping?: boolean;
  tone?: DotTone;
};

const toneClassName: Record<DotTone, string> = {
  error: "bg-destructive",
  muted: "bg-foreground/55",
  success: "bg-success",
  warning: "bg-warning",
};

export const Dot = ({ className, ping = false, tone = "muted" }: DotProps) => {
  const color = toneClassName[tone];

  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)}>
      {ping ? (
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full", color)} />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
};
