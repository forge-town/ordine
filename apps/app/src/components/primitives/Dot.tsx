import { cn } from "@repo/ui/lib/utils";

export type DotTone = "muted" | "success" | "error" | "warning";

export type DotProps = {
  className?: string;
  ping?: boolean;
  tone?: DotTone;
};

const toneClassName: Record<DotTone, string> = {
  muted: "bg-foreground/55",
  success: "bg-success",
  error: "bg-destructive",
  warning: "bg-warning",
};

export const Dot = ({ className, ping = false, tone = "muted" }: DotProps) => {
  const color = toneClassName[tone];

  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)}>
      {ping ? (
        <span
          className={cn("ping absolute inline-flex h-full w-full rounded-full opacity-40", color)}
        />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
};
