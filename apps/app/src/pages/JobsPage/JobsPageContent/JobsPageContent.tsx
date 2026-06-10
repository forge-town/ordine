import { useStore } from "zustand";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, Clock, ListChecks, Play } from "lucide-react";
import type { Job, PipelineData, Routine } from "@repo/schemas";
import { useList, useUpdate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Chip, Icon, SearchInput, Stat } from "@/components/primitives";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { JOB_STATUS_FILTERS, useJobsPageStore, type JobStatusFilter } from "../_store";
import { JobRow } from "../JobRow";

const isSameDay = (date: Date | undefined, target: Date) => {
  if (!date) return false;

  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
};

const hasWaitingNode = (job: Job) =>
  Object.values(job.nodeStatuses ?? {}).some((status) => status === "waitingForUser");

const getJobFilterValue = (job: Job): JobStatusFilter[] => {
  const values: JobStatusFilter[] = ["All"];
  if (job.status === "running") values.push("Running");
  if (job.status === "queued" || hasWaitingNode(job)) values.push("Waiting");
  if (job.status === "done") values.push("Completed");
  if (job.status === "failed" || job.status === "expired") values.push("Failed");

  return values;
};

const formatSchedule = (routine: Routine) => {
  if (routine.triggerType === "cron") return routine.cronExpression ?? "cron";
  if (routine.eventType) return `event · ${routine.eventType}`;

  return "event";
};

const formatNextRun = (routine: Routine) => {
  if (!routine.enabled) return "paused";
  if (!routine.nextRunAt) return "not scheduled";

  return routine.nextRunAt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const JobsPageContent = () => {
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
  const { mutate: updateRoutine } = useUpdate();
  const navigate = useNavigate();
  const store = useJobsPageStore();
  const search = useStore(store, (s) => s.search);
  const statusFilter = useStore(store, (s) => s.statusFilter);
  const handleSearchInputChange = useStore(store, (s) => s.handleSearchInputChange);
  const handleSearchClearButtonClick = useStore(store, (s) => s.handleSearchClearButtonClick);
  const handleStatusFilterButtonClick = useStore(store, (s) => s.handleStatusFilterButtonClick);

  const pipelineNameById = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name]));
  const today = new Date();
  const runningJobs = jobs.filter((job) => job.status === "running");
  const waitingJobs = jobs.filter((job) => job.status === "queued" || hasWaitingNode(job));
  const completedToday = jobs.filter(
    (job) => job.status === "done" && isSameDay(job.finishedAt ?? job.meta?.updatedAt, today),
  );
  const failedToday = jobs.filter(
    (job) =>
      (job.status === "failed" || job.status === "expired") &&
      isSameDay(job.finishedAt ?? job.meta?.updatedAt, today),
  );
  const terminalToday = completedToday.length + failedToday.length;
  const successRate =
    terminalToday > 0 ? Math.round((completedToday.length / terminalToday) * 100) : 0;
  const filterCounts: Record<JobStatusFilter, number> = {
    All: jobs.length,
    Running: runningJobs.length,
    Waiting: waitingJobs.length,
    Completed: jobs.filter((job) => job.status === "done").length,
    Failed: jobs.filter((job) => job.status === "failed" || job.status === "expired").length,
  };

  const filtered = jobs.filter((j: Job) => {
    const q = search.toLowerCase();
    const pipelineName = j.pipelineId ? pipelineNameById.get(j.pipelineId) : undefined;
    const matchStatus = getJobFilterValue(j).includes(statusFilter);
    const matchSearch =
      !q ||
      j.title.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q) ||
      j.type.toLowerCase().includes(q) ||
      (pipelineName ?? "").toLowerCase().includes(q);

    return matchStatus && matchSearch;
  });

  const handleRoutineToggle = (routine: Routine) => {
    updateRoutine({
      resource: ResourceName.routines,
      id: routine.id,
      values: { enabled: !routine.enabled },
    });
  };

  const handleRoutineToggleClick = (routine: Routine) => () => handleRoutineToggle(routine);
  const handleNewRunClick = () => void navigate({ to: "/pipelines" });

  if (jobsQuery?.isLoading || routinesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title="Jobs" />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button className="flex items-center gap-1.5" size="sm" onClick={handleNewRunClick}>
            <Play className="h-3.5 w-3.5" />
            New Run
          </Button>
        }
        eyebrow="Monitor"
        icon={<Icon className="text-muted-foreground" icon={ListChecks} size={18} />}
        sub="Work orders - every pipeline run, concurrent and live. Launch on demand or on a Routine."
        title="Jobs"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Running"
            sub={
              runningJobs
                .slice(0, 2)
                .map((job) => job.id)
                .join(" · ") || "No active runs"
            }
            value={runningJobs.length}
          />
          <Stat
            label="Queued / Waiting"
            sub={`${waitingJobs.filter(hasWaitingNode).length} awaiting you`}
            value={waitingJobs.length}
          />
          <Stat
            label="Completed today"
            sub={`${successRate}% success`}
            tone="success"
            value={completedToday.length}
          />
          <Stat
            label="Failed today"
            sub={failedToday[0]?.error ?? "No failures"}
            tone={failedToday.length > 0 ? "error" : "default"}
            value={failedToday.length}
          />
        </div>

        <section className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <Icon icon={Clock} size={13} />
            Routines
          </div>
          {routines.length === 0 ? (
            <div className="rounded-2xl bg-surface p-4 text-[12.5px] text-muted-foreground ring-1 ring-border shadow-soft">
              No routines configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {routines.map((routine) => (
                <div
                  key={routine.id}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-border shadow-soft"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                    <Icon className="text-foreground/70" icon={CalendarClock} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold tracking-tightish">
                      {routine.name}
                    </div>
                    <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                      {formatSchedule(routine)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">next</div>
                    <div className="text-[11.5px] font-medium">{formatNextRun(routine)}</div>
                  </div>
                  <button
                    aria-label={`${routine.enabled ? "Pause" : "Resume"} ${routine.name}`}
                    className={cn(
                      "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                      routine.enabled ? "bg-foreground" : "bg-surface-3",
                    )}
                    type="button"
                    onClick={handleRoutineToggleClick(routine)}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full bg-primary-foreground transition-transform",
                        routine.enabled && "translate-x-4",
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-0.5">
              {JOB_STATUS_FILTERS.map((filter) => (
                <Chip
                  key={filter}
                  active={statusFilter === filter}
                  count={filterCounts[filter]}
                  onClick={() => handleStatusFilterButtonClick(filter)}
                >
                  {filter}
                </Chip>
              ))}
            </div>
            <SearchInput
              className="w-56"
              placeholder="Search jobs..."
              value={search}
              onChange={handleSearchInputChange}
              onClear={handleSearchClearButtonClick}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="grid place-items-center rounded-2xl bg-surface-2/50 py-16 text-center text-muted-foreground">
              <ListChecks className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-[13px] font-medium text-foreground">
                {jobs.length === 0 ? "No jobs yet" : "No matching jobs"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Launch a run or adjust the current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  pipelineName={
                    job.pipelineId ? (pipelineNameById.get(job.pipelineId) ?? job.title) : job.title
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
