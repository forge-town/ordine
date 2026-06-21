import type { ChangeEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "./Icon";

export type SearchInputProps = {
  className?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  value?: string;
};

export const SearchInput = ({
  className,
  onChange,
  onClear,
  placeholder = "Search...",
  value,
}: SearchInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.value);
  };
  const handleClear = () => {
    onClear?.();
  };

  return (
    <div className={cn("relative", className)}>
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        icon={Search}
        size={14}
      />
      <input
        className="w-full rounded-xl bg-surface-2 py-1.5 pr-7 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border-strong"
        placeholder={placeholder}
        style={{ paddingLeft: "2.1rem" }}
        value={value}
        onChange={handleChange}
      />
      {value && onClear ? (
        <button
          className="absolute right-2.5 top-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
          type="button"
          onClick={handleClear}
        >
          <Icon icon={X} size={12} />
        </button>
      ) : null}
    </div>
  );
};
