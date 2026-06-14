import { ArrowRight, Sparkles } from "lucide-react";
import { Icon } from "@/components/primitives";

export type DistillCardProps = {
  onOpen?: () => void;
  subtitle: string;
  title: string;
};

/** Minimal distill row — `✨ Saved as a Pipeline Skill — open in Components →`. */
export const DistillCard = ({ onOpen, subtitle, title }: DistillCardProps) => (
  <button
    className="inline-flex items-center gap-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    data-testid="agent-distill"
    type="button"
    onClick={() => onOpen?.()}
  >
    <Icon icon={Sparkles} size={11} />
    <span className="truncate">
      {title} · {subtitle}
    </span>
    <Icon icon={ArrowRight} size={11} />
  </button>
);
