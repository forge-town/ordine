import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  routines?: Routine[];
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
  routines,
}: ScheduleEditorProps) => {
  const { t } = useTranslation();
  const availableRoutines = routines ?? (routine ? [routine] : []);
  const initialRoutine = routine ?? availableRoutines[0] ?? null;
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(
    initialRoutine?.id ?? null,
  );
  const [isNewRoutineSelected, setIsNewRoutineSelected] = useState(false);
  const selectedRoutine =
    availableRoutines.find((candidate) => candidate.id === selectedRoutineId) ?? null;
  const [cronParts, setCronParts] = useState(() =>
    toCronParts(initialRoutine?.cronExpression ?? "0 6 * * *"),
  );
  const [enabled, setEnabled] = useState(initialRoutine?.enabled ?? true);
  const [hasExplicitCron, setHasExplicitCron] = useState(
    initialRoutine === null || initialRoutine.cronExpression !== null,
  );
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

  useEffect(() => {
    if (isNewRoutineSelected) return;
    if (availableRoutines.some((candidate) => candidate.id === selectedRoutineId)) return;

    const nextRoutine = routine ?? availableRoutines[0] ?? null;
    if (!nextRoutine) return;

    setSelectedRoutineId(nextRoutine.id);
    setCronParts(toCronParts(nextRoutine.cronExpression ?? "0 6 * * *"));
    setEnabled(nextRoutine.enabled);
    setHasExplicitCron(nextRoutine.cronExpression !== null);
    setValidationError(null);
  }, [availableRoutines, isNewRoutineSelected, routine, selectedRoutineId]);

  const handleCronPartChange = (index: number, value: string) => {
    setValidationError(null);
    setHasExplicitCron(true);
    setCronParts((parts) => parts.map((part, partIndex) => (partIndex === index ? value : part)));
  };

  const handlePresetClick = (cron: string) => {
    setValidationError(null);
    setHasExplicitCron(true);
    setCronParts(toCronParts(cron));
  };

  const handleRoutineChange = (routineId: string) => {
    const nextRoutine = availableRoutines.find((candidate) => candidate.id === routineId) ?? null;
    setIsNewRoutineSelected(nextRoutine === null);
    setSelectedRoutineId(nextRoutine?.id ?? null);
    setCronParts(toCronParts(nextRoutine?.cronExpression ?? "0 6 * * *"));
    setEnabled(nextRoutine?.enabled ?? true);
    setHasExplicitCron(nextRoutine === null || nextRoutine.cronExpression !== null);
    setValidationError(null);
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedRoutineId !== null && selectedRoutine === null) {
      setValidationError(t("jobs.scheduleEditor.saveFailed"));

      return;
    }
    const parsed = CreateRoutineSchema.safeParse({
      cronExpression: enabled || hasExplicitCron ? cronExpression : null,
      description: selectedRoutine?.description ?? null,
      enabled,
      inputConfig: selectedRoutine?.inputConfig ?? null,
      name: selectedRoutine?.name ?? pipelineName,
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

    if (selectedRoutine) {
      updateRoutine({ ...mutationInput, id: selectedRoutine.id }, mutationOptions);
    } else {
      createRoutine(mutationInput, mutationOptions);
    }
  };

  const handleDelete = () => {
    if (!selectedRoutine) return;

    deleteRoutine(
      {
        errorNotification: false,
        id: selectedRoutine.id,
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
        className="max-h-[min(42rem,calc(100vh-2rem))] w-[min(32rem,calc(100vw-2rem))] min-w-0 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-lg"
        data-testid="schedule-editor"
        showCloseButton={false}
      >
        <form className="min-w-0" onSubmit={handleSave}>
          <DialogHeader className="min-w-0 flex-row items-center gap-3 border-b px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
              <CalendarClock className="size-4 text-foreground/75" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{t("jobs.scheduleEditor.title")}</DialogTitle>
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

          <div className="min-w-0 space-y-5 overflow-y-auto px-4 py-4">
            {availableRoutines.length > 0 ? (
              <label className="block text-xs font-semibold text-muted-foreground">
                {t("jobs.scheduleEditor.routineLabel")}
                <select
                  className="mt-2 h-8 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="schedule-routine-select"
                  value={selectedRoutine?.id ?? "__new__"}
                  onChange={(event) => handleRoutineChange(event.target.value)}
                >
                  {availableRoutines.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} -
                      {candidate.cronExpression ?? t("jobs.scheduleEditor.noCron")}
                    </option>
                  ))}
                  <option value="__new__">{t("jobs.scheduleEditor.newRoutine")}</option>
                </select>
              </label>
            ) : null}

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
            {selectedRoutine ? (
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
