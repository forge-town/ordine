import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "./Icon";

export type MiniChainStep = {
  compound?: boolean;
  icon: LucideIcon;
  label?: string;
};

export type MiniChainProps = {
  className?: string;
  steps: MiniChainStep[];
};

export const MiniChain = ({ className, steps }: MiniChainProps) => {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {steps.map((step, index) => (
        <div key={`${step.label ?? "step"}-${index}`} className="contents">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-[7px]",
              step.compound ? "bg-foreground/8 ring-1 ring-border-strong" : "bg-surface-2",
            )}
            title={step.label}
          >
            <Icon className="text-foreground/70" icon={step.icon} size={11} />
          </span>
          {index < steps.length - 1 ? <span className="h-px w-2.5 bg-border-strong" /> : null}
        </div>
      ))}
    </div>
  );
};
