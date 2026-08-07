import { useMemo, useState } from "react";
import { useCustom } from "@refinedev/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Job, Routine, RoutineOccurrencesResponse } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";

export type JobsCalendarProps = {
  jobs: Job[];
  pipelineNameById: Map<string, string>;
  routines: Routine[];
  onEditRoutine: (routine: Routine) => void;
  onNewRoutine: () => void;
  onOpenJob: (job: Job) => void;
};

type CalendarEvent = {
  at: Date;
  id: string;
  job?: Job;
  label: string;
  routine?: Routine;
  status: Job["status"] | "scheduled";
  aggregated?: boolean;
};

const DAY_MS = 86_400_000;
const CAL_START = 0;
const CAL_END = 24;
const HOUR_HEIGHT = 34;

const mondayOf = (date: Date): Date => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));

  return day;
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const hhmm = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" });

const eventStyle = (status: CalendarEvent["status"]): string => {
  if (status === "scheduled") {
    return "border border-dashed border-border-strong bg-transparent text-muted-foreground";
  }
  if (status === "running") {
    return "bg-foreground text-background";
  }
  if (status === "failed" || status === "expired") {
    return "bg-destructive/[0.08] text-foreground ring-1 ring-destructive/30";
  }
  if (status === "paused" || status === "queued") {
    return "bg-surface-2 text-foreground ring-1 ring-border-strong";
  }
  if (status === "cancelled") {
    return "bg-surface-2/60 text-muted-foreground ring-1 ring-border";
  }

  return "bg-surface text-foreground ring-1 ring-border shadow-soft";
};

const placeDayEvents = (events: CalendarEvent[]) => {
  const sorted = events
    .map((event) => ({
      event,
      top: (event.at.getHours() + event.at.getMinutes() / 60 - CAL_START) * HOUR_HEIGHT,
    }))
    .sort((left, right) => left.top - right.top);
  const placed: Array<(typeof sorted)[number] & { col: number; cols: number }> = [];

  for (let index = 0; index < sorted.length; ) {
    const cluster: typeof sorted = [];
    const clusterTop = sorted[index]!.top;
    while (index < sorted.length && sorted[index]!.top - clusterTop < 22) {
      cluster.push(sorted[index]!);
      index += 1;
    }
    cluster.forEach((item, col) => placed.push({ ...item, col, cols: cluster.length }));
  }

  return placed;
};

export const JobsCalendar = ({
  jobs,
  onEditRoutine,
  onNewRoutine,
  onOpenJob,
  pipelineNameById,
  routines,
}: JobsCalendarProps) => {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const now = new Date();
  const weekStart = useMemo(
    () => new Date(mondayOf(now).getTime() + weekOffset * 7 * DAY_MS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekOffset],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => new Date(weekStart.getTime() + index * DAY_MS)),
    [weekStart],
  );
  const weekEnd = useMemo(() => new Date(weekStart.getTime() + 7 * DAY_MS), [weekStart]);
  const { result: occurrencesResult } = useCustom<RoutineOccurrencesResponse>({
    config: {
      payload: {
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
      },
    },
    method: "get",
    url: "routines/occurrences",
  });
  const routineById = useMemo(
    () => new Map(routines.map((routine) => [routine.id, routine])),
    [routines],
  );

  const events = useMemo(() => {
    const collected: CalendarEvent[] = [];
    for (const job of jobs) {
      if (!job.startedAt) {
        continue;
      }
      const at = new Date(job.startedAt);
      if (at < weekStart || at.getTime() >= weekStart.getTime() + 7 * DAY_MS) {
        continue;
      }
      collected.push({
        at,
        id: job.id,
        job,
        label: job.pipelineId ? (pipelineNameById.get(job.pipelineId) ?? job.title) : job.title,
        status: job.status,
      });
    }
    for (const occurrence of occurrencesResult.data?.occurrences ?? []) {
      const routine = routineById.get(occurrence.routineId);
      if (!routine?.enabled) {
        continue;
      }

      const at = new Date(occurrence.at);
      if (at.getTime() <= Date.now()) {
        continue;
      }
      collected.push({
        aggregated: occurrence.aggregated,
        at,
        id: `ghost-${routine.id}-${at.getTime()}`,
        label: routine.name,
        routine,
        status: "scheduled",
      });
    }

    return collected;
  }, [
    jobs,
    occurrencesResult.data?.occurrences,
    pipelineNameById,
    routineById,
    weekEnd,
    weekStart,
  ]);

  const gridHeight = (CAL_END - CAL_START) * HOUR_HEIGHT;
  const nowTop = (now.getHours() + now.getMinutes() / 60 - CAL_START) * HOUR_HEIGHT;
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

  return (
    <div
      className="overflow-x-auto rounded-lg bg-surface ring-1 ring-border shadow-soft"
      data-testid="jobs-calendar"
    >
      <div className="min-w-[760px]">
        <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
          <span className="text-[13px] font-semibold">{rangeLabel}</span>
          <span className="text-[10.5px] text-muted-foreground">
            {weekOffset === 0
              ? t("jobs.calendar.thisWeek")
              : weekOffset > 0
                ? `+${weekOffset}w`
                : `${weekOffset}w`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 hidden items-center gap-3 text-[10px] text-muted-foreground lg:flex">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm bg-surface ring-1 ring-border" />
                {t("jobs.calendar.ranLegend")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm border border-dashed border-border-strong" />
                {t("jobs.calendar.scheduledLegend")}
              </span>
            </span>
            <button
              aria-label={t("jobs.calendar.previousWeek")}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              data-testid="jobs-calendar-prev"
              type="button"
              onClick={() => setWeekOffset((value) => value - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              className="rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              data-testid="jobs-calendar-today"
              type="button"
              onClick={() => setWeekOffset(0)}
            >
              {t("jobs.calendar.today")}
            </button>
            <button
              aria-label={t("jobs.calendar.nextWeek")}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              data-testid="jobs-calendar-next"
              type="button"
              onClick={() => setWeekOffset((value) => value + 1)}
            >
              <ChevronRight className="size-3.5" />
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background hover:opacity-90"
              data-testid="jobs-calendar-schedule"
              type="button"
              onClick={onNewRoutine}
            >
              <Plus className="size-3" />
              {t("jobs.calendar.schedule")}
            </button>
          </div>
        </div>

        {occurrencesResult.data?.truncated ||
        occurrencesResult.data?.occurrences?.some((occurrence) => occurrence.aggregated) ? (
          <div
            className="border-b border-border/70 bg-surface-2/60 px-3.5 py-1.5 text-[10px] text-muted-foreground"
            data-testid="jobs-calendar-condensed"
          >
            {t("jobs.calendar.condensed", {
              defaultValue: "High-frequency schedules are condensed to one block per hour.",
            })}
          </div>
        ) : null}

        <div
          className="grid border-b border-border/70"
          style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
        >
          <div />
          {days.map((day) => {
            const isToday = sameDay(day, now);

            return (
              <div
                key={day.toISOString()}
                className="flex items-center justify-center gap-1.5 border-l border-border/50 py-2"
              >
                <span
                  className={cn(
                    "text-[10px] uppercase",
                    isToday ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                    isToday ? "bg-foreground font-semibold text-background" : "text-foreground/80",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="relative grid"
          style={{ gridTemplateColumns: "48px repeat(7, 1fr)", height: gridHeight }}
        >
          <div className="relative">
            {Array.from({ length: CAL_END - CAL_START }, (_, index) => (
              <div
                key={index}
                className="absolute right-2 -translate-y-1/2 font-mono text-[9px] text-muted-foreground/80"
                style={{ top: index * HOUR_HEIGHT || 8 }}
              >
                {index === 0 ? "" : `${String(CAL_START + index).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const isToday = sameDay(day, now);
            const dayEvents = placeDayEvents(events.filter((event) => sameDay(event.at, day)));

            return (
              <div
                key={day.toISOString()}
                className={cn("relative border-l border-border/50", isToday && "bg-accent/25")}
              >
                {Array.from({ length: CAL_END - CAL_START }, (_, index) => (
                  <div
                    key={index}
                    className="absolute inset-x-0 border-t border-border/40"
                    style={{ top: index * HOUR_HEIGHT }}
                  />
                ))}
                {dayEvents.map(({ col, cols, event, top }) => {
                  const width = 100 / cols;

                  return (
                    <button
                      key={event.id}
                      className={cn(
                        "absolute z-10 flex items-center gap-1 truncate rounded-md px-1.5 text-left text-[9.5px] font-medium leading-none transition-all hover:z-20 hover:shadow-float",
                        eventStyle(event.status),
                      )}
                      data-testid={`jobs-calendar-block-${event.id}`}
                      style={{
                        height: 20,
                        left: `calc(${col * width}% + 4px)`,
                        top: top + 1,
                        width: `calc(${width}% - 8px)`,
                      }}
                      title={`${event.label} · ${hhmm(event.at)}${event.aggregated ? " · +" : ""}`}
                      type="button"
                      onClick={() => {
                        if (event.routine) {
                          onEditRoutine(event.routine);
                          return;
                        }
                        if (event.job) {
                          onOpenJob(event.job);
                        }
                      }}
                    >
                      {event.status === "running" ? (
                        <span className="size-1 shrink-0 animate-pulse rounded-full bg-background" />
                      ) : null}
                      {event.status === "done" ? (
                        <span className="size-1 shrink-0 rounded-full bg-success" />
                      ) : null}
                      {event.status === "failed" ? (
                        <span className="size-1 shrink-0 rounded-full bg-destructive" />
                      ) : null}
                      <span className="truncate">{event.label}</span>
                      {event.aggregated ? (
                        <span className="shrink-0 text-[8px] text-muted-foreground">+</span>
                      ) : null}
                      {cols === 1 ? (
                        <span
                          className={cn(
                            "ml-auto shrink-0 font-mono text-[8.5px]",
                            event.status === "running" ? "opacity-70" : "text-muted-foreground",
                          )}
                        >
                          {hhmm(event.at)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {isToday && nowTop > 0 && nowTop < gridHeight ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20"
                    data-testid="jobs-calendar-now"
                    style={{ top: nowTop }}
                  >
                    <div className="h-px w-full bg-destructive/75" />
                    <div className="absolute -left-0.5 -top-[2.5px] size-[5px] rounded-full bg-destructive" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
