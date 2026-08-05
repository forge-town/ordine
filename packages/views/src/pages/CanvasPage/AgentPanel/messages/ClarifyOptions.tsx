import { CornerDownRight } from "lucide-react";
import { Icon } from "../../../../components/primitives";

export type ClarifyOptionsProps = {
  disabled?: boolean;
  onSelect: (option: string) => void;
  options: string[];
};

/**
 * Clarify-phase quick answers (PRD §7.4) — minimal borderless rows mirroring
 * SuggestionList. Clicking an option sends it verbatim as the user's reply.
 */
export const ClarifyOptions = ({ disabled = false, onSelect, options }: ClarifyOptionsProps) => (
  <div className="space-y-0.5 pl-3" data-testid="agent-clarify-options">
    {options.map((option) => (
      <button
        key={option}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-foreground/75 transition-colors hover:bg-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="agent-clarify-option"
        disabled={disabled}
        type="button"
        onClick={() => onSelect(option)}
      >
        <Icon className="shrink-0 text-muted-foreground" icon={CornerDownRight} size={12} />
        <span className="min-w-0 flex-1 truncate">{option}</span>
      </button>
    ))}
  </div>
);
