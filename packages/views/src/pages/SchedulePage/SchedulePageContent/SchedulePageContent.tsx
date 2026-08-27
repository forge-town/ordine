import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, Pencil, Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCustomMutation, useList } from "@refinedev/core";
import type { Job, PipelineData, Routine } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "../../../constants";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { PageState } from "../../../components/PageState";
import { ScheduleEditor } from "../../../components/ScheduleEditor";
import { PipelinePickerDialog } from "../../../components/PipelinePickerDialog";
import { JobsCalendar } from "../../JobsPage/JobsCalendar";

type SchedulingState =
  | "pick"
  | {
      pipelineId: string;
      pipelineName: string;
      routine: Routine | null;
    }
  | null;

const CRON_PRESET_KEYS: Record<string, string> = {
  "0 * * * *": "hourly",
  "0 6 * * *": "daily",
  "0 9 * * 1-5": "weekdays",
  "0 9 * * 1": "weekly",
};

export const SchedulePageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { result: routinesResult, query: routinesQuery } = useList<Routine>({
    resource: ResourceName.routines,
  });
  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const { result: jobsResult, query: jobsQuery } = useList<Job>({
    resource: ResourceName.jobs,
  });
  const { mutateAsync: runNow, mutation: runNowMutation } = useCustomMutation();
  const [scheduling, setScheduling] = useState<SchedulingState>(null);
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);

  const routines = routinesResult.data;
  const pipelines = pipelinesResult.data;
  const jobs = jobsResult.data;
  const pipelineNameById = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name]));

  const cronLabel = (cronExpression: string | null) => {
    if (!cronExpression) return t("jobs.scheduleEditor.noCron");
    const preset = CRON_PRESET_KEYS[cronExpression];

    return preset ? t(`jobs.scheduleEditor.presets.${preset}Human`) : cronExpression;
  };

  const handleNewRoutineClick = () => setScheduling("pick");
  const handlePickerClose = () => setScheduling(null);
  const handlePipelinePick = (pipeline: PipelineData) => {
    setScheduling({ pipelineId: pipeline.id, pipelineName: pipeline.name, routine: null });
  };
  const handleEditRoutine = (routine: Routine) => {
    setScheduling({
      pipelineId: routine.pipelineId,
      pipelineName: pipelineNameById.get(routine.pipelineId) ?? routine.name,
      routine,
    });
  };
  const handleScheduleEditorClose = () => {
    setScheduling(null);
    void routinesQuery?.refetch?.();
  };
  const handleRunNow = (routine: Routine) => async () => {
    setRunningRoutineId(routine.id);
    try {
      await runNow({
        errorNotification: false,
        method: "post",
        successNotification: false,
        url: "routines/runNow",
        values: { id: routine.id },
      });
      void jobsQuery?.refetch?.();
    } finally {
      setRunningRoutineId(null);
    }
  };
  const handleOpenJob = () => void navigate({ to: "/pipelines/jobs" });

  if (routinesQuery?.isLoading || jobsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          icon={<CalendarClock className="h-4 w-4 text-primary" />}
          sub={t("schedule.subtitle")}
          title={t("schedule.title")}
        />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button
            className="flex items-center gap-1.5"
            data-testid="schedule-new-routine"
            size="sm"
            onClick={handleNewRoutineClick}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("jobs.newRoutine")}
          </Button>
        }
        icon={<CalendarClock className="h-4 w-4 text-primary" />}
        sub={t("schedule.subtitle")}
        title={t("schedule.title")}
      />

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {routines.length === 0 ? (
          <PageState
            description={t("schedule.emptyDescription")}
            icon={<CalendarClock />}
            title={t("schedule.emptyTitle")}
          />
        ) : (
          <div
            className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface"
            data-testid="schedule-routine-list"
          >
            {routines.map((routine) => (
              <div
                key={routine.id}
                className="flex items-center gap-3 px-4 py-3"
                data-testid={`schedule-routine-${routine.id}`}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    routine.enabled ? "bg-info" : "bg-muted-foreground/45",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{routine.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pipelineNameById.get(routine.pipelineId) ?? routine.pipelineId}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {cronLabel(routine.cronExpression)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {routine.enabled ? t("schedule.enabled") : t("schedule.disabled")}
                </span>
                <Button
                  className="shrink-0"
                  data-testid={`schedule-run-${routine.id}`}
                  disabled={runNowMutation.isPending && runningRoutineId === routine.id}
                  size="sm"
                  variant="outline"
                  onClick={handleRunNow(routine)}
                >
                  <Play className="h-3.5 w-3.5" />
                  {t("schedule.runNow")}
                </Button>
                <Button
                  aria-label={t("common.edit")}
                  className="shrink-0"
                  data-testid={`schedule-edit-${routine.id}`}
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleEditRoutine(routine)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <JobsCalendar
          jobs={jobs}
          pipelineNameById={pipelineNameById}
          routines={routines}
          onEditRoutine={handleEditRoutine}
          onNewRoutine={handleNewRoutineClick}
          onOpenJob={handleOpenJob}
        />
      </div>

      {scheduling === "pick" ? (
        <PipelinePickerDialog
          pipelines={pipelines}
          routines={routines}
          onClose={handlePickerClose}
          onPick={handlePipelinePick}
        />
      ) : null}
      {scheduling && scheduling !== "pick" ? (
        <ScheduleEditor
          pipelineId={scheduling.pipelineId}
          pipelineName={scheduling.pipelineName}
          routine={scheduling.routine}
          routines={routines.filter((routine) => routine.pipelineId === scheduling.pipelineId)}
          onClose={handleScheduleEditorClose}
        />
      ) : null}
    </div>
  );
};
