import {
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RuntimeModel } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";

interface SearchableModelSelectProps {
  className?: string;
  disabled?: boolean;
  models: RuntimeModel[];
  supportsCustomModel: boolean;
  value?: string;
  onChange: (model: string) => void;
}

export const SearchableModelSelect = ({
  className,
  disabled,
  models,
  supportsCustomModel,
  value,
  onChange: handleChange,
}: SearchableModelSelectProps) => {
  const { t } = useTranslation();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const options = useMemo(
    () =>
      value && !models.some((model) => model.id === value)
        ? [{ id: value, displayName: `${value} (custom)` }, ...models]
        : models,
    [models, value],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter((model) =>
        `${model.id}\n${model.displayName}`.toLowerCase().includes(normalizedQuery),
      )
    : options;
  const customCandidate = query.trim();
  const canUseCustom =
    supportsCustomModel &&
    customCandidate.length > 0 &&
    !options.some((model) => model.id.toLowerCase() === customCandidate.toLowerCase());
  const selected = options.find((model) => model.id === value);
  const shouldShowSearch = options.length >= 8 || supportsCustomModel;
  useEffect(() => {
    if (open && shouldShowSearch) searchInputRef.current?.focus({ preventScroll: true });
  }, [open, shouldShowSearch]);
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  };
  const handleSelectModel = (model: string) => {
    handleChange(model);
    setOpen(false);
    setQuery("");
  };
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !canUseCustom) return;
    event.preventDefault();
    handleSelectModel(customCandidate);
  };
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };
  const handleOptionClick = (event: MouseEvent<HTMLButtonElement>) => {
    const model = event.currentTarget.dataset.model;
    if (model) handleSelectModel(model);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        data-testid="agent-execution-model-trigger"
        disabled={disabled}
      >
        <span className="max-w-48 truncate">
          {selected?.displayName ?? value ?? t("agentExecutionPicker.model")}
        </span>
        <ChevronsUpDown className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-1.5rem))] p-2">
        {shouldShowSearch && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              aria-label={t("agentExecutionPicker.modelSearchLabel")}
              className="h-8 pl-8 text-xs"
              data-testid="agent-execution-model-search"
              placeholder={
                supportsCustomModel
                  ? t("agentExecutionPicker.modelSearchCustom")
                  : t("agentExecutionPicker.modelSearch")
              }
              value={query}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
        )}
        <div className="max-h-72 space-y-0.5 overflow-y-auto" id={listboxId} role="listbox">
          {filtered.map((model) => (
            <Button
              key={model.id}
              aria-selected={model.id === value}
              className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
              data-model={model.id}
              data-testid={`agent-execution-model-${model.id}`}
              role="option"
              variant="ghost"
              onClick={handleOptionClick}
            >
              <Check
                className={cn(
                  "size-3.5 shrink-0",
                  model.id === value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{model.displayName}</span>
                {model.id !== model.displayName && (
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {model.id}
                  </span>
                )}
              </span>
            </Button>
          ))}
          {canUseCustom && (
            <Button
              className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
              data-model={customCandidate}
              data-testid="agent-execution-custom-model"
              role="option"
              variant="ghost"
              onClick={handleOptionClick}
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate text-xs">
                {t("agentExecutionPicker.useCustomModel", { model: customCandidate })}
              </span>
            </Button>
          )}
          {filtered.length === 0 && !canUseCustom && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {t("agentExecutionPicker.noModelsFound")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
