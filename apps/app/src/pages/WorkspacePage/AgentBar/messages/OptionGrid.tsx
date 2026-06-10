import { Check } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "@/components/primitives";

export type OptionGridItem = {
  active?: boolean;
  id: string;
  label: string;
  onSelect?: () => void;
};

export type OptionGridProps = {
  items: OptionGridItem[];
};

export const OptionGrid = ({ items }: OptionGridProps) => {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((item) => {
        const handleSelectClick = () => item.onSelect?.();

        return (
          <button
            key={item.id}
            className={cn(
              "flex min-h-8 items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-[11.5px] ring-1 transition-colors",
              item.active
                ? "bg-accent ring-border-strong"
                : "bg-surface ring-border hover:bg-accent/60",
            )}
            type="button"
            onClick={handleSelectClick}
          >
            {item.active ? <Icon icon={Check} size={11} /> : null}
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
