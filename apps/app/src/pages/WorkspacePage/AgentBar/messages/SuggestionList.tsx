import { CornerDownRight, FileUp } from "lucide-react";
import { Icon } from "@/components/primitives";

export type SuggestionItem = {
  id: string;
  label: string;
  onSelect?: () => void;
  reverse?: boolean;
};

export type SuggestionListProps = {
  items: SuggestionItem[];
};

/** Minimal suggestion rows — borderless, hover-tinted (prototype empty state). */
export const SuggestionList = ({ items }: SuggestionListProps) => (
  <div className="space-y-0.5" data-testid="agent-suggestions">
    {items.map((item) => (
      <button
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-foreground/75 transition-colors hover:bg-accent/50 hover:text-foreground"
        key={item.id}
        type="button"
        onClick={() => item.onSelect?.()}
      >
        <Icon
          className="shrink-0 text-muted-foreground"
          icon={item.reverse ? FileUp : CornerDownRight}
          size={12}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </button>
    ))}
  </div>
);
