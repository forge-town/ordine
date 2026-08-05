import type { ChangeEvent } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";

export type SearchInputProps = {
  className?: string;
  clearLabel?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  value?: string;
};

export const SearchInput = ({
  className,
  clearLabel = "Clear search",
  onChange,
  onClear,
  placeholder = "Search...",
  value,
}: SearchInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.value);
  };
  const handleClear = () => onClear?.();

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        className="h-8 bg-surface-2 pl-8 pr-8 text-xs"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
      {value && onClear ? (
        <Button
          aria-label={clearLabel}
          className="absolute right-1 top-1/2 -translate-y-1/2"
          size="icon-xs"
          type="button"
          variant="ghost"
          onClick={handleClear}
        >
          <X className="size-3" />
        </Button>
      ) : null}
    </div>
  );
};
