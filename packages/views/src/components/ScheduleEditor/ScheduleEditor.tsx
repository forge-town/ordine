import { useMemo, useState, type FormEvent } from "react";
import { useCreate, useDelete, useUpdate } from "@refinedev/core";
import { CalendarClock, Info, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CreateRoutineSchema, type Routine } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "../../constants";

export type ScheduleEditorProps = {
  onClose: () => void;
  pipelineId: string;
  pipelineName: string;
  routine?: Routine | null;
};

const CRON_PRESETS = [
  { cron: "0 * * * *", key: "hourly" },
  { cron: "0 6 * * *", key: "daily" },
  { cron: "0 9 * * 1-5", key: "weekdays" },
  { cron: "0 9 * * 1", key: "weekly" },
] as const;

const CRON_PART_KEYS = ["minute", "hour", "day", "month", "weekday"] as const;

const toCronParts = (cronExpression: string) => {
  const parts = cronExpression.trim().split(/\s+/).slice(0, CRON_PART_KEYS.length);

  return CRON_PART_KEYS.map((_, index) => parts[index] ?? "*");
};

export const ScheduleEditor = ({
  onClose,
  pipelineId,
  pipelineName,
  routine = null,
}: ScheduleEditorProps) => {
  const { t } = useTranslation();
  const [cronParts, setCronParts] = useState(() =>
    toCronParts(routine?.cronExpression ?? "0 6 * * *"),
  );
  const [enabled, setEnabled] = useState(routine?.enabled ?? true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutate: createRoutine, mutation: createMutation } = useCreate();
  const { mutate: updateRoutine, mutation: updateMutation } = useUpdate();
  const { mutate: deleteRoutine, mutation: deleteMutation } = useDelete();
  const cronExpression = cronParts.map((part) => part.trim() || "*").join(" ");
  const activePreset = CRON_PRESETS.find((preset) => preset.cron === cronExpression);
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const summary = useMemo(
    () =>
      activePreset
        ? t(`jobs.scheduleEditor.presets.${activePreset.key}Human`)
        : t("jobs.scheduleEditor.summary.cron", { cron: cronExpression }),
    [activePreset, cronExpression, t],
  );

  const handleCronPartChange = (index: number, value: string) => {
    setValidationError(null);
    setCronParts((parts) => parts.map((part, partIndex) => (partIndex === index ? value : part)));
  };

  const handlePresetClick = (cron: string) => {
    setValidationError(null);
    setCronParts(toCronParts(cron));
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = CreateRoutineSchema.safeParse({
      cronExpression,
      description: routine?.description ?? null,
      enabled,
      inputConfig: routine?.inputConfig ?? null,
      name: routine?.name ?? pipelineName,
      pipelineId,
    });

    if (!parsed.success) {
      setValidationError(t("jobs.scheduleEditor.invalidCron"));

      return;
    }

    const mutationOptions = {
      onError: () => setValidationError(t("jobs.scheduleEditor.saveFailed")),
      onSuccess: onClose,
    };
    const mutationInput = {
      errorNotification: false as const,
      resource: ResourceName.routines,
      successNotification: false as const,
      values: parsed.data,
    };

    if (routine) {
      updateRoutine({ ...mutationInput, id: routine.id }, mutationOptions);
    } else {
      createRoutine(mutationInput, mutationOptions);
    }
  };

  const handleDelete = () => {
    if (!routine) return;

    deleteRoutine(
      {
        errorNotification: false,
        id: routine.id,
        resource: ResourceName.routines,
        successNotification: false,
      },
      {
        onError: () => setValidationError(t("jobs.scheduleEditor.deleteFailed")),
        onSuccess: onClose,
      },
    );
  };
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) onClose();
  };
  const handleEnabledToggle = () => setEnabled((value) => !value);
  const handleClose = () => onClose();

  return (
    <Dialog open onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-h-[min(42rem,calc(100vh-2rem))] gap-0 overflow-hidden p-0 sm:max-w-lg"
        data-testid="schedule-editor"
        showCloseButton={false}
      >
        <form onSubmit={handleSave}>
          <DialogHeader className="flex-row items-center gap-3 border-b px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
              <CalendarClock className="size-4 text-foreground/75" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle>{t("jobs.scheduleEditor.title")}</DialogTitle>
              <DialogDescription className="truncate text-xs">{pipelineName}</DialogDescription>
            </div>
            <button
              aria-checked={enabled}
              aria-label={t("jobs.scheduleEditor.enabledToggle")}
              className={cn(
                "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                enabled ? "bg-foreground" : "bg-surface-3",
              )}
              data-testid="schedule-enabled-toggle"
              role="switch"
              type="button"
              onClick={handleEnabledToggle}
            >
              <span
                className={cn(
                  "size-4 rounded-full bg-surface transition-transform",
                  enabled && "translate-x-4",
                )}
              />
            </button>
            <Button
              aria-label={t("jobs.scheduleEditor.close")}
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={handleClose}
            >
              <X className="size-4" />
            </Button>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto px-4 py-4">
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("jobs.scheduleEditor.presetsLabel")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map((preset) => (
                  <Button
                    key={preset.cron}
                    data-testid={`schedule-preset-${preset.key}`}
                    size="xs"
                    type="button"
                    variant={cronExpression === preset.cron ? "default" : "outline"}
                    onClick={() => handlePresetClick(preset.cron)}
                  >
                    {t(`jobs.scheduleEditor.presets.${preset.key}`)}
                  </Button>
                ))}
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("jobs.scheduleEditor.cronExpression")}
              </legend>
              <div className="grid grid-cols-5 gap-1.5">
                {CRON_PART_KEYS.map((part, index) => (
                  <label key={part} className="min-w-0 text-center">
                    <Input
                      aria-invalid={validationError ? true : undefined}
                      className="px-1 text-center font-mono text-xs"
                      data-testid={`schedule-cron-${part}`}
                      value={cronParts[index]}
                      onChange={(event) => handleCronPartChange(index, event.target.value)}
                    />
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {t(`jobs.scheduleEditor.cronParts.${part}`)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {validationError ? (
              <p className="text-xs text-destructive" role="alert">
                {validationError}
              </p>
            ) : null}

            <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{summary}</span>
            </div>
          </div>

          <DialogFooter className="m-0 rounded-none px-4 py-3">
            {routine ? (
              <Button
                className="mr-auto"
                data-testid="schedule-delete"
                disabled={isPending}
                size="sm"
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5" />
                {t("jobs.scheduleEditor.delete")}
              </Button>
            ) : null}
            <Button
              disabled={isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              {t("jobs.scheduleEditor.cancel")}
            </Button>
            <Button data-testid="schedule-save" disabled={isPending} size="sm" type="submit">
              {isPending ? t("jobs.scheduleEditor.saving") : t("jobs.scheduleEditor.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
