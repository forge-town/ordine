import { CornerDownRight, FileUp } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "@/components/primitives";

export type SuggestionItem = {
  id: string;
  label: string;
  onSelect?: () => void;
  priorityLabel?: string;
  reverse?: boolean;
};

export type SuggestionListProps = {
  items: SuggestionItem[];
};

export const SuggestionList = ({ items }: SuggestionListProps) => {
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const handleSelectClick = () => item.onSelect?.();

        return (
          <button
            key={item.id}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] ring-1 transition-colors",
              item.reverse
                ? "bg-surface ring-foreground/20 hover:bg-accent/50"
                : "bg-surface ring-border hover:bg-accent/50",
            )}
            type="button"
            onClick={handleSelectClick}
          >
            <Icon
              className="text-muted-foreground"
              icon={item.reverse ? FileUp : CornerDownRight}
              size={13}
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.priorityLabel ? (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground">
                {item.priorityLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
