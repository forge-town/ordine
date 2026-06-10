import type { ReactNode } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "@/components/primitives";

export type AssistantProps = {
  children: ReactNode;
  className?: string;
  isThinking?: boolean;
  label?: string;
};

export const Assistant = ({
  children,
  className,
  isThinking = false,
  label = "Agent",
}: AssistantProps) => {
  const StatusIcon = isThinking ? LoaderCircle : Sparkles;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-foreground text-primary-foreground">
          <Icon className={isThinking ? "spin" : undefined} icon={StatusIcon} size={9} />
        </span>
        {label}
      </div>
      <div className="text-[12px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
};
