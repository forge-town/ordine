import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { Icon } from "@/components/primitives";
import { Card } from "./Card";

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

export const SelfHealCard = ({ open = false, steps, subtitle, title }: SelfHealCardProps) => {
  const ToggleIcon = open ? ChevronDown : ChevronRight;

  return (
    <Card>
      <div className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <div className="flex h-6 w-6 items-center justify-center rounded-md status-wash-success">
          <Icon icon={Check} size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <Icon className="text-muted-foreground" icon={ToggleIcon} size={14} />
      </div>
      {open ? (
        <ol className="space-y-1.5 border-t border-border/70 px-3 py-2.5 text-[11px] text-muted-foreground">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={step.tone === "success" ? "text-foreground" : undefined}
            >
              {index + 1}. {step.label}
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
};
