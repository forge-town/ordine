import { Bot, Check, ChevronDown, ExternalLink, Gauge, Settings2 } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { AgentExecutionChoice, AgentRuntimeCatalogEntry } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import {
  changeExecutionModel,
  DEFAULT_FIRST_OUTPUT_TIMEOUT_SECONDS,
  runtimeCatalogEntryIsSelectable,
} from "./agentExecutionChoice";
import { SearchableModelSelect } from "./SearchableModelSelect";

interface AgentExecutionPickerProps {
  catalog: AgentRuntimeCatalogEntry[];
  choice: AgentExecutionChoice | null;
  className?: string;
  compact?: boolean;
  triggerVariant?: "summary" | "button";
  disabled?: boolean;
  isolationDescription?: string;
  isLoading?: boolean;
  onChange: (choice: AgentExecutionChoice) => void;
  onRuntimeChange: (runtimeConfigId: string) => void;
  onOpenSettings?: () => void;
  runtimeDisabledReasons?: Readonly<Record<string, string>>;
}

export const AgentExecutionPicker = ({
  catalog,
  choice,
  className,
  compact = false,
  triggerVariant = "summary",
  disabled,
  isolationDescription,
  isLoading,
  onChange: handleChange,
  onRuntimeChange: handleRuntimeChange,
  onOpenSettings: handleOpenSettings,
  runtimeDisabledReasons = {},
}: AgentExecutionPickerProps) => {
  const { t } = useTranslation();
  const currentEntry = catalog.find((entry) => entry.runtimeConfigId === choice?.runtimeConfigId);
  const currentModel = currentEntry?.models.find((model) => model.id === choice?.model);
  const reasoningOptions = currentModel?.reasoningEfforts ?? [];
  const speedOptions = currentModel?.speeds ?? [];
  const [timeoutDraft, setTimeoutDraft] = useState(
    String(choice?.firstOutputTimeoutSeconds ?? DEFAULT_FIRST_OUTPUT_TIMEOUT_SECONDS),
  );
  useEffect(() => {
    setTimeoutDraft(
      String(choice?.firstOutputTimeoutSeconds ?? DEFAULT_FIRST_OUTPUT_TIMEOUT_SECONDS),
    );
  }, [choice?.firstOutputTimeoutSeconds, choice?.runtimeConfigId]);
  const isolationLabel =
    isolationDescription ??
    (currentEntry?.runtime === "codex"
      ? t("agentExecutionPicker.nativeSandbox")
      : t("agentExecutionPicker.bestEffortPolicy"));
  const displayModel =
    currentModel?.displayName ?? choice?.model ?? t("agentExecutionPicker.model");
  const isButtonTrigger = triggerVariant === "button";
  const handleRuntimeClick = (event: MouseEvent<HTMLButtonElement>) => {
    const runtimeConfigId = event.currentTarget.dataset.runtimeConfigId;
    if (runtimeConfigId) handleRuntimeChange(runtimeConfigId);
  };
  const handleModelChange = (model: string) => {
    if (currentEntry && choice) {
      handleChange(changeExecutionModel(currentEntry, choice, model));
    }
  };
  const handleReasoningChange = (reasoningEffort: string | null) => {
    if (choice && reasoningEffort) handleChange({ ...choice, reasoningEffort });
  };
  const handleSpeedChange = (speed: string | null) => {
    if (choice && speed) handleChange({ ...choice, speed });
  };
  const commitTimeout = () => {
    if (!choice) return;
    const parsed = Number(timeoutDraft);
    const seconds = Number.isFinite(parsed) ? Math.min(3600, Math.max(0, Math.round(parsed))) : 45;
    setTimeoutDraft(String(seconds));
    if (seconds !== choice.firstOutputTimeoutSeconds) {
      handleChange({ ...choice, firstOutputTimeoutSeconds: seconds });
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("agentExecutionPicker.label")}
        className={cn(
          "flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          compact &&
            !isButtonTrigger &&
            "h-auto rounded-none p-0 text-[10.5px] hover:bg-transparent",
          isButtonTrigger &&
            "h-auto rounded-full bg-surface px-3.5 py-1.5 font-medium text-foreground shadow-pill ring-1 ring-border hover:bg-surface hover:ring-border-strong max-[480px]:px-2",
          className,
        )}
        data-testid="agent-execution-picker-trigger"
        disabled={disabled || isLoading}
      >
        {isButtonTrigger ? (
          <>
            <Bot className="size-3.5 shrink-0" />
            <span className="max-[480px]:sr-only">{t("agentExecutionPicker.model")}</span>
          </>
        ) : (
          <>
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                currentEntry?.availability === "launchable"
                  ? "bg-success"
                  : "bg-muted-foreground/45",
              )}
            />
            <span className="truncate font-medium">
              {isLoading
                ? t("agentExecutionPicker.loading")
                : (currentEntry?.displayName ?? t("agentExecutionPicker.configure"))}
            </span>
            {choice?.model && (
              <>
                <span aria-hidden="true">·</span>
                <span className="max-w-40 truncate">{displayModel}</span>
              </>
            )}
          </>
        )}
        <ChevronDown className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[45dvh] w-[min(32rem,calc(100vw-1.5rem))] space-y-3 overflow-y-auto p-3 sm:max-h-[calc(100dvh-2rem)]"
        data-testid="agent-execution-picker-popover"
        sideOffset={8}
      >
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Bot className="size-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold">{t("agentExecutionPicker.localCli")}</p>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3" role="radiogroup">
            {catalog.map((entry) => {
              const runtimeDisabledReason = entry.runtimeConfigId
                ? runtimeDisabledReasons[entry.runtimeConfigId]
                : undefined;
              const selectable =
                runtimeCatalogEntryIsSelectable(entry) && runtimeDisabledReason === undefined;
              const active = entry.runtimeConfigId === choice?.runtimeConfigId;

              return (
                <Button
                  key={entry.runtime}
                  aria-checked={active}
                  className={cn(
                    "h-auto min-w-0 justify-start gap-2 px-2.5 py-2 text-left",
                    active && "bg-accent text-accent-foreground",
                  )}
                  data-runtime-config-id={entry.runtimeConfigId ?? undefined}
                  data-testid={`agent-execution-runtime-${entry.runtime}`}
                  disabled={!selectable}
                  role="radio"
                  title={
                    runtimeDisabledReason ??
                    entry.diagnostics[0]?.message ??
                    entry.version ??
                    entry.displayName
                  }
                  variant="outline"
                  onClick={handleRuntimeClick}
                >
                  <Check
                    className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{entry.displayName}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {selectable
                        ? (entry.version ?? t("agentExecutionPicker.detected"))
                        : runtimeDisabledReason
                          ? t("agentExecutionPicker.controlModeUnsupported")
                          : entry.compatibility.supportLevel === "supported"
                            ? t("agentExecutionPicker.notLaunchable")
                            : t("agentExecutionPicker.experimental")}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {currentEntry && choice && (
          <div className="space-y-2.5 border-t border-border pt-3">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {t("agentExecutionPicker.model")}
              </span>
              <SearchableModelSelect
                className="w-full justify-between border border-border"
                models={currentEntry.models}
                supportsCustomModel={currentEntry.supportsCustomModel}
                value={choice.model}
                onChange={handleModelChange}
              />
            </div>
            {reasoningOptions.length > 0 && (
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {t("agentExecutionPicker.reasoning")}
                </span>
                <Select
                  value={choice.reasoningEffort ?? currentModel?.defaultReasoningEffort ?? ""}
                  onValueChange={handleReasoningChange}
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {reasoningOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label ?? option.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {speedOptions.length > 0 && (
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {t("agentExecutionPicker.speed")}
                </span>
                <Select
                  value={choice.speed ?? currentModel?.defaultSpeed ?? ""}
                  onValueChange={handleSpeedChange}
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {speedOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label ?? option.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {t("agentExecutionPicker.firstOutputTimeout")}
              </span>
              <div className="flex items-center gap-2">
                <input
                  aria-label={t("agentExecutionPicker.firstOutputTimeout")}
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  inputMode="numeric"
                  max={3600}
                  min={0}
                  type="number"
                  value={timeoutDraft}
                  onBlur={commitTimeout}
                  onChange={(event) => setTimeoutDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <span className="shrink-0 text-[10.5px] text-muted-foreground">
                  {t("agentExecutionPicker.seconds")}
                </span>
              </div>
              <span className="col-start-2 text-[10px] leading-4 text-muted-foreground">
                {t("agentExecutionPicker.firstOutputTimeoutHint")}
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-[10.5px] leading-4 text-muted-foreground">
              <Gauge className="mt-0.5 size-3.5 shrink-0" />
              <span>{isolationLabel}</span>
            </div>
          </div>
        )}

        {handleOpenSettings && (
          <Button
            className="w-full justify-between"
            size="sm"
            variant="ghost"
            onClick={handleOpenSettings}
          >
            <span className="inline-flex items-center gap-2">
              <Settings2 className="size-3.5" />
              {t("agentExecutionPicker.openSettings")}
            </span>
            <ExternalLink className="size-3" />
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};
