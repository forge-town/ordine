import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "@/components/primitives";

export type AssistantProps = {
  children: ReactNode;
  className?: string;
  isThinking?: boolean;
};

/** Minimal assistant message — plain text, no card chrome. */
export const Assistant = ({ children, className, isThinking = false }: AssistantProps) => (
  <div
    className={cn("text-[12px] leading-relaxed text-foreground/90", className)}
    data-testid="agent-assistant"
  >
    {isThinking ? (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Icon className="animate-spin" icon={LoaderCircle} size={11} />
        {children}
      </span>
    ) : (
      children
    )}
  </div>
);
