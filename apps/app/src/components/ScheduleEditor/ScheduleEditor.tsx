import { useState } from "react";
import { useCreate, useDelete, useUpdate } from "@refinedev/core";
import { CalendarClock, Clock, Hand, Info, X, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import type { Routine, RoutineTriggerType } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

export type ScheduleEditorProps = {
  pipelineId: string;
  pipelineName: string;
  routine?: Routine | null;
  onClose: () => void;
};

type TriggerChoice = RoutineTriggerType | "manual";

const CRON_PRESETS = [
  { cron: "0 * * * *", key: "hourly" },
  { cron: "0 6 * * *", key: "daily" },
  { cron: "0 9 * * 1-5", key: "weekdays" },
  { cron: "0 9 * * 1", key: "weekly" },
] as const;

const EVENT_TYPES = [
  "ticket.created",
  "file.added",
  "pr.opened",
  "row.inserted",
  "email.received",
] as const;

const CRON_PART_KEYS = ["minute", "hour", "day", "month", "weekday"] as const;

export const ScheduleEditor = ({
  onClose,
  pipelineId,
  pipelineName,
  routine = null,
}: ScheduleEditorProps) => {
  const { t } = useTranslation();
  const [trigger, setTrigger] = useState<TriggerChoice>(routine?.triggerType ?? "manual");
  const [cron, setCron] = useState(routine?.cronExpression ?? "0 6 * * *");
  const [eventType, setEventType] = useState(routine?.eventType ?? EVENT_TYPES[0]);
  const [enabled, setEnabled] = useState(routine?.enabled ?? true);
  const { mutate: createRoutine } = useCreate();
  const { mutate: updateRoutine } = useUpdate();
  const { mutate: deleteRoutine } = useDelete();

  const cronParts = cron.split(" ");
  const setCronPart = (index: number, value: string) => {
    const parts = [...cronParts];
    while (parts.length < 5) {
      parts.push("*");
    }
    parts[index] = value.trim() || "*";
    setCron(parts.join(" "));
  };
  const activePreset = CRON_PRESETS.find((preset) => preset.cron === cron);
  const summary =
    trigger === "manual"
      ? t("jobs.scheduleEditor.summary.manual")
      : trigger === "cron"
        ? activePreset
          ? t(`jobs.scheduleEditor.presets.${activePreset.key}Human`)
          : t("jobs.scheduleEditor.summary.cron", { cron })
        : t("jobs.scheduleEditor.summary.event", { event: eventType });

  const handleDelete = () => {
    if (routine) {
      deleteRoutine({
        errorNotification: false,
        id: routine.id,
        resource: ResourceName.routines,
        successNotification: false,
      });
    }
    onClose();
  };

  const handleSave = () => {
    if (trigger === "manual") {
      handleDelete();

      return;
    }

    const values = {
      cronExpression: trigger === "cron" ? cron : null,
      enabled,
      eventType: trigger === "event" ? eventType : null,
      name: pipelineName,
      pipelineId,
      triggerType: trigger,
    };

    if (routine) {
      updateRoutine({
        errorNotification: false,
        id: routine.id,
        resource: ResourceName.routines,
        successNotification: false,
        values,
      });
    } else {
      createRoutine({
        errorNotification: false,
        resource: ResourceName.routines,
        successNotification: false,
        values,
      });
    }
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center p-6"
      data-testid="schedule-editor"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div
        className="relative flex max-h-[88%] w-[480px] flex-col overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2">
            <CalendarClock className="size-4 text-foreground/75" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{t("jobs.scheduleEditor.title")}</div>
            <div className="truncate text-[10.5px] text-muted-foreground">{pipelineName}</div>
          </div>
          <button
            aria-label={t("jobs.scheduleEditor.enabledToggle")}
            className={cn(
              "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
              enabled ? "bg-foreground" : "bg-surface-3",
            )}
            data-testid="schedule-enabled-toggle"
            type="button"
            onClick={() => setEnabled((value) => !value)}
          >
            <span
              className={cn(
                "size-4 rounded-full bg-surface transition-transform",
                enabled && "translate-x-4",
              )}
            />
          </button>
          <Button aria-label={t("jobs.scheduleEditor.close")} size="icon" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("jobs.scheduleEditor.trigger")}
            </div>
            <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
              {(
                [
                  ["manual", Hand],
                  ["cron", Clock],
                  ["event", Zap],
                ] as const
              ).map(([choice, IconComponent]) => (
                <button
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                    trigger === choice
                      ? "bg-surface text-foreground shadow-soft ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`schedule-trigger-${choice}`}
                  key={choice}
                  type="button"
                  onClick={() => setTrigger(choice)}
                >
                  <IconComponent className="size-3.5" />
                  {t(`jobs.scheduleEditor.triggers.${choice}`)}
                </button>
              ))}
            </div>
          </div>

          {trigger === "cron" ? (
            <div className="space-y-2.5">
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {t("jobs.scheduleEditor.presetsLabel")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11.5px] ring-1 transition-colors",
                        cron === preset.cron
                          ? "bg-foreground text-background ring-foreground"
                          : "bg-surface ring-border hover:bg-accent/60",
                      )}
                      data-testid={`schedule-preset-${preset.key}`}
                      key={preset.cron}
                      type="button"
                      onClick={() => setCron(preset.cron)}
                    >
                      {t(`jobs.scheduleEditor.presets.${preset.key}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {t("jobs.scheduleEditor.cronExpression")}
                </div>
                <div className="flex items-start gap-1.5">
                  {CRON_PART_KEYS.map((part, index) => (
                    <div className="flex-1" key={part}>
                      <Input
                        className="text-center font-mono text-xs"
                        data-testid={`schedule-cron-${part}`}
                        value={cronParts[index] ?? "*"}
                        onChange={(event) => setCronPart(index, event.target.value)}
                      />
                      <div className="mt-1 text-center text-[9px] uppercase tracking-wide text-muted-foreground">
                        {t(`jobs.scheduleEditor.cronParts.${part}`)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {trigger === "event" ? (
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("jobs.scheduleEditor.event")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((candidate) => (
                  <button
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-[11px] ring-1 transition-colors",
                      eventType === candidate
                        ? "bg-foreground text-background ring-foreground"
                        : "bg-surface ring-border hover:bg-accent/60",
                    )}
                    data-testid={`schedule-event-${candidate}`}
                    key={candidate}
                    type="button"
                    onClick={() => setEventType(candidate)}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="size-3 shrink-0" />
            <span className="truncate">{summary}</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {routine ? (
              <Button
                className="text-destructive"
                data-testid="schedule-delete"
                size="sm"
                variant="ghost"
                onClick={handleDelete}
              >
                {t("jobs.scheduleEditor.delete")}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={onClose}>
              {t("jobs.scheduleEditor.cancel")}
            </Button>
            <Button data-testid="schedule-save" size="sm" onClick={handleSave}>
              {t("jobs.scheduleEditor.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
