import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Icon } from "@/components/primitives";

export type SelfHealStep = {
  label: string;
  tone?: "muted" | "success";
};

export type SelfHealCardProps = {
  open?: boolean;
  steps: SelfHealStep[];
  subtitle: string;
  title: string;
};

/** Minimal self-heal row — one collapsible line, left-border steps when open. */
export const SelfHealCard = ({ open = false, steps, subtitle, title }: SelfHealCardProps) => {
  const [expanded, setExpanded] = useState(open);

  return (
    <div data-testid="agent-self-heal">
      <button
        className="inline-flex items-center gap-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        data-testid="agent-self-heal-toggle"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <Icon icon={RefreshCw} size={11} />
        <span className="truncate">
          {title} · {subtitle}
        </span>
        <Icon icon={expanded ? ChevronDown : ChevronRight} size={11} />
      </button>
      {expanded ? (
        <ol className="mt-1.5 space-y-1 border-l border-border pl-3 text-[11px] text-muted-foreground">
          {steps.map((step, index) => (
            <li
              className={step.tone === "success" ? "text-foreground" : undefined}
              key={`${index}-${step.label}`}
            >
              {step.label}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
};
