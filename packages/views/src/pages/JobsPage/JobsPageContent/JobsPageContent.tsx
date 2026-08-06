import { useState } from "react";
import { useStore } from "zustand";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, ListChecks, Play, Rows3, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Job, PipelineData, Routine } from "@repo/schemas";
import { useList } from "@refinedev/core";
import { ResourceName } from "../../../constants";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { PageHeader } from "../../../components/PageHeader";
import { ScheduleEditor } from "../../../components/ScheduleEditor";
import { Chip, Icon, SearchInput } from "../../../components/primitives";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { JOB_STATUS_FILTERS, useJobsPageStore, type JobStatusFilter } from "../_store";
import { JobDetailDrawer } from "../JobDetailDrawer";
import { JobsCalendar } from "../JobsCalendar";
import { JobsTable } from "../JobsTable";

type JobsView = "calendar" | "list";

const FILTER_LABEL_KEYS: Record<JobStatusFilter, string> = {
  All: "jobs.filters.all",
  Completed: "jobs.filters.completed",
  Failed: "jobs.filters.failed",
  Running: "jobs.filters.running",
  Waiting: "jobs.filters.waiting",
};

const hasWaitingNode = (job: Job) =>
  Object.values(job.nodeStatuses ?? {}).some((status) => status === "waitingForUser");

const getJobFilterValue = (job: Job): JobStatusFilter[] => {
  const values: JobStatusFilter[] = ["All"];
  if (job.status === "running" || job.status === "paused") values.push("Running");
  if (job.status === "queued" || hasWaitingNode(job)) values.push("Waiting");
  if (job.status === "done") values.push("Completed");
  if (job.status === "failed" || job.status === "expired") values.push("Failed");

  return values;
};

export const JobsPageContent = () => {
  const { t } = useTranslation();
  const { result: jobsResult, query: jobsQuery } = useList<Job>({
    resource: ResourceName.jobs,
  });
  const { result: routinesResult, query: routinesQuery } = useList<Routine>({
    resource: ResourceName.routines,
  });
  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const jobs = jobsResult.data;
  const routines = routinesResult.data;
  const pipelines = pipelinesResult.data;
  const navigate = useNavigate();
  const store = useJobsPageStore();
  const search = useStore(store, (s) => s.search);
  const statusFilter = useStore(store, (s) => s.statusFilter);
  const handleSearchInputChange = useStore(store, (s) => s.handleSearchInputChange);
  const handleSearchClearButtonClick = useStore(store, (s) => s.handleSearchClearButtonClick);
  const handleStatusFilterButtonClick = useStore(store, (s) => s.handleStatusFilterButtonClick);
  const [view, setView] = useState<JobsView>("list");
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [scheduling, setScheduling] = useState<"pick" | PipelineData | null>(null);

  const pipelineNameById = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name]));
  const counts = {
    failed: jobs.filter((job) => job.status === "failed" || job.status === "expired").length,
    queued: jobs.filter((job) => job.status === "queued").length,
    running: jobs.filter((job) => job.status === "running" || job.status === "paused").length,
    waiting: jobs.filter(hasWaitingNode).length,
  };
  const filterCounts: Record<JobStatusFilter, number> = {
    All: jobs.length,
    Completed: jobs.filter((job) => job.status === "done").length,
    Failed: counts.failed,
    Running: counts.running,
    Waiting: jobs.filter((job) => job.status === "queued" || hasWaitingNode(job)).length,
  };

  const filtered = jobs.filter((job) => {
    const q = search.toLowerCase();
    const pipelineName = job.pipelineId ? pipelineNameById.get(job.pipelineId) : undefined;
    const matchStatus = getJobFilterValue(job).includes(statusFilter);
    const matchSearch =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.id.toLowerCase().includes(q) ||
      (pipelineName ?? "").toLowerCase().includes(q);

    return matchStatus && matchSearch;
  });

  const handleOpenJob = (job: Job) => {
    setDetailJob(job);
  };
  const refetchAll = () => {
    void jobsQuery?.refetch?.();
  };

  if (jobsQuery?.isLoading || routinesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("jobs.title")} />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <>
            <Button
              className="flex items-center gap-1.5"
              size="sm"
              variant="outline"
              onClick={() => setScheduling("pick")}
            >
              <Clock className="h-3.5 w-3.5" />
              {t("jobs.newRoutine")}
            </Button>
            <Button
              className="flex items-center gap-1.5"
              size="sm"
              onClick={() => void navigate({ to: "/pipelines" })}
            >
              <Play className="h-3.5 w-3.5" />
              {t("jobs.newRun")}
            </Button>
          </>
        }
        eyebrow={t("jobs.eyebrow")}
        icon={<Icon className="text-muted-foreground" icon={ListChecks} size={18} />}
        sub={t("jobs.subtitle")}
        title={t("jobs.title")}
      />

      <div className="flex flex-wrap items-center gap-3 px-4 pb-3.5 sm:px-7">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1" data-testid="jobs-view-toggle">
          {(
            [
              ["list", Rows3],
              ["calendar", CalendarDays],
            ] as const
          ).map(([candidate, IconComponent]) => (
            <button
              key={candidate}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === candidate
                  ? "bg-surface text-foreground shadow-soft ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`jobs-view-${candidate}`}
              type="button"
              onClick={() => setView(candidate)}
            >
              <IconComponent className="size-3.5" />
              {t(`jobs.views.${candidate}`)}
            </button>
          ))}
        </div>
        {view === "list" ? (
          <>
            <span className="text-[11px] text-muted-foreground" data-testid="jobs-summary">
              {t("jobs.summary", counts)}
            </span>
            <div className="flex w-full min-w-0 flex-col gap-2 lg:ml-auto lg:w-auto lg:flex-row lg:items-center">
              <div className="flex max-w-full items-center gap-0.5 overflow-x-auto pb-1 lg:pb-0">
                {JOB_STATUS_FILTERS.map((filter) => (
                  <Chip
                    key={filter}
                    active={statusFilter === filter}
                    className="shrink-0"
                    count={filterCounts[filter]}
                    onClick={() => handleStatusFilterButtonClick(filter)}
                  >
                    {t(FILTER_LABEL_KEYS[filter])}
                  </Chip>
                ))}
              </div>
              <SearchInput
                className="w-full lg:w-52"
                placeholder={t("jobs.searchPlaceholder")}
                value={search}
                onChange={handleSearchInputChange}
                onClear={handleSearchClearButtonClick}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-7">
        {view === "list" ? (
          filtered.length === 0 ? (
            <div className="grid place-items-center py-16 text-center text-muted-foreground">
              <ListChecks className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-[13px] font-medium text-foreground">
                {jobs.length === 0 ? t("jobs.emptyTitle") : t("jobs.noMatchTitle")}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">{t("jobs.emptyBody")}</p>
            </div>
          ) : (
            <JobsTable
              jobs={filtered}
              pipelineNameById={pipelineNameById}
              onChanged={refetchAll}
              onOpen={handleOpenJob}
            />
          )
        ) : (
          <JobsCalendar
            jobs={jobs}
            pipelineNameById={pipelineNameById}
            routines={routines}
            onEditRoutine={(routine) => {
              const pipeline = pipelines.find((item) => item.id === routine.pipelineId);
              setScheduling(
                pipeline ?? {
                  ...({} as PipelineData),
                  id: routine.pipelineId,
                  name: routine.name,
                },
              );
            }}
            onNewRoutine={() => setScheduling("pick")}
            onOpenJob={handleOpenJob}
          />
        )}
      </div>

      {detailJob ? (
        <JobDetailDrawer
          job={detailJob}
          onChanged={refetchAll}
          onClose={() => setDetailJob(null)}
        />
      ) : null}
      {scheduling === "pick" ? (
        <div
          className="absolute inset-0 z-50 grid place-items-center p-6"
          data-testid="jobs-pipeline-picker"
          onClick={() => setScheduling(null)}
        >
          <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
          <div
            className="relative w-[min(380px,calc(100vw_-_2rem))] overflow-hidden rounded-lg bg-surface shadow-float ring-1 ring-border-strong"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
              <Clock className="size-3.5 text-foreground/75" />
              <span className="flex-1 text-sm font-semibold">{t("jobs.pickPipeline")}</span>
              <Button
                aria-label={t("jobs.closePipelinePicker")}
                size="icon"
                variant="ghost"
                onClick={() => setScheduling(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {pipelines.length === 0 ? (
                <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                  {t("jobs.noPipelines")}
                </p>
              ) : null}
              {pipelines.map((pipeline) => (
                <button
                  key={pipeline.id}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent/60"
                  data-testid={`jobs-pick-${pipeline.id}`}
                  type="button"
                  onClick={() => setScheduling(pipeline)}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{pipeline.name}</span>
                  {(routines.some((routine) => routine.pipelineId === pipeline.id) && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t("jobs.hasRoutine")}
                    </span>
                  )) ||
                    null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {scheduling && scheduling !== "pick" ? (
        <ScheduleEditor
          pipelineId={scheduling.id}
          pipelineName={scheduling.name}
          routines={routines.filter((routine) => routine.pipelineId === scheduling.id)}
          onClose={() => {
            setScheduling(null);
            void routinesQuery?.refetch?.();
          }}
        />
      ) : null}
    </div>
  );
};
