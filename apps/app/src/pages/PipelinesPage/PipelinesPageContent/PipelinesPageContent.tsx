import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Layers, Plus, Workflow } from "lucide-react";
import { Button } from "@repo/ui/button";
import { useCreate, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { Job, PipelineAsset, PipelineData, Routine } from "@repo/schemas";
import { useStore } from "zustand";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Chip, Icon, SearchInput } from "@/components/primitives";
import { useSidebarStore } from "@/store/sidebarStore";
import { PIPELINE_FILTERS, usePipelinesPageStore, type PipelineFilter } from "../_store";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { PipelineCard } from "../PipelineCard";

const getJobDurationMs = (job: Job): number | null => {
  if (!job.startedAt || !job.finishedAt) return null;

  return Math.max(0, job.finishedAt.getTime() - job.startedAt.getTime());
};

const getAverageDurationMs = (jobs: Job[]): number | null => {
  const durations = jobs
    .map(getJobDurationMs)
    .filter((duration): duration is number => duration !== null);
  if (durations.length === 0) return null;

  return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length);
};

export const PipelinesPageContent = () => {
  const { t } = useTranslation();
  const { result: pipelinesResult, query: pipelinesQuery } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const { result: assetsResult } = useList<PipelineAsset>({
    resource: ResourceName.pipelineAssets,
  });
  const { result: jobsResult } = useList<Job>({
    resource: ResourceName.jobs,
  });
  const { result: routinesResult } = useList<Routine>({
    resource: ResourceName.routines,
  });
  const pipelines = pipelinesResult.data;
  const assets = assetsResult.data;
  const jobs = jobsResult.data;
  const routines = routinesResult.data;
  const store = usePipelinesPageStore();
  const sidebarStore = useSidebarStore();
  const activeFilter = useStore(store, (s) => s.activeFilter);
  const search = useStore(store, (s) => s.search);
  const currentProjectId = useStore(sidebarStore, (s) => s.currentProjectId);
  const handleFilterChipClick = useStore(store, (s) => s.handleFilterChipClick);
  const handleSearchInputChange = useStore(store, (s) => s.handleSearchInputChange);
  const handleClearSearchButtonClick = useStore(store, (s) => s.handleClearSearchButtonClick);
  const navigate = useNavigate();
  const [schedulingPipeline, setSchedulingPipeline] = useState<PipelineData | null>(null);
  const { mutateAsync: createPipelineMutate } = useCreate();

  const savedPipelineIds = useMemo(
    () => new Set(assets.map((asset) => asset.pipelineId)),
    [assets],
  );
  const routinesByPipelineId = useMemo(() => {
    const map = new Map<string, Routine[]>();
    for (const routine of routines) {
      map.set(routine.pipelineId, [...(map.get(routine.pipelineId) ?? []), routine]);
    }

    return map;
  }, [routines]);
  const jobsByPipelineId = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      if (!job.pipelineId) continue;
      map.set(job.pipelineId, [...(map.get(job.pipelineId) ?? []), job]);
    }

    return map;
  }, [jobs]);
  const filterCounts = useMemo<Record<PipelineFilter, number>>(
    () => ({
      All: pipelines.length,
      Drafts: pipelines.filter((pipeline) => pipeline.status === "draft").length,
      "Saved Skills": pipelines.filter((pipeline) => savedPipelineIds.has(pipeline.id)).length,
      Scheduled: pipelines.filter(
        (pipeline) => (routinesByPipelineId.get(pipeline.id) ?? []).length > 0,
      ).length,
    }),
    [pipelines, routinesByPipelineId, savedPipelineIds],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return pipelines.filter((pipeline: PipelineData) => {
      const hasRoutine = (routinesByPipelineId.get(pipeline.id) ?? []).length > 0;
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Saved Skills" && savedPipelineIds.has(pipeline.id)) ||
        (activeFilter === "Drafts" && pipeline.status === "draft") ||
        (activeFilter === "Scheduled" && hasRoutine);
      const matchesSearch =
        !q ||
        pipeline.name.toLowerCase().includes(q) ||
        (pipeline.description ?? "").toLowerCase().includes(q) ||
        pipeline.id.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, pipelines, routinesByPipelineId, savedPipelineIds, search]);

  const handleCreate = async () => {
    const id = `pipeline-${globalThis.crypto.randomUUID()}`;
    const now = new Date();
    const newPipeline: PipelineData = {
      id,
      projectId: currentProjectId,
      status: "draft",
      version: 1,
      name: "Untitled pipeline",
      description: "Draft a new automation flow from this workspace.",
      tags: [],
      createdAt: now,
      updatedAt: now,
      timeoutMs: null,
      nodes: [],
      edges: [],
    };
    const result = await createPipelineMutate({
      resource: ResourceName.pipelines,
      values: newPipeline,
    });
    const saved = result.data as PipelineData;
    void navigate({ to: "/workspace/$pipelineId", params: { pipelineId: saved.id } });
  };

  const handleCreateClick = () => void handleCreate();
  const handleOpenPipeline = (pipelineId: string) => {
    void navigate({ to: "/workspace/$pipelineId", params: { pipelineId } });
  };

  if (pipelinesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("nav.items.pipelines")} />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button className="flex items-center gap-1.5" size="sm" onClick={handleCreateClick}>
            <Plus className="h-3.5 w-3.5" />
            New Pipeline
          </Button>
        }
        eyebrow="Assembly"
        icon={<Icon className="text-muted-foreground" icon={Workflow} size={18} />}
        sub="Reusable production lines. Clean runs become Pipeline Skills you can re-run with new input."
        title="Pipelines"
      />

      <div className="flex items-center gap-2 px-7 pb-3.5">
        <div className="flex items-center gap-0.5">
          {PIPELINE_FILTERS.map((filter) => (
            <Chip
              key={filter}
              active={activeFilter === filter}
              count={filterCounts[filter]}
              onClick={() => handleFilterChipClick(filter)}
            >
              {filter}
            </Chip>
          ))}
        </div>
        <SearchInput
          className="ml-auto w-60"
          placeholder="Search pipelines..."
          value={search}
          onChange={handleSearchInputChange}
          onClear={handleClearSearchButtonClick}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
        {filtered.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-surface-2/50 py-16 text-center text-muted-foreground">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-[13px] font-medium text-foreground">
              {pipelines.length === 0 ? "No pipelines yet" : "No matching pipelines"}
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Create a draft or try a different search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((pipeline) => {
              const pipelineJobs = jobsByPipelineId.get(pipeline.id) ?? [];
              const successfulJobs = pipelineJobs.filter((job) => job.status === "done").length;
              const successRate =
                pipelineJobs.length > 0
                  ? Math.round((successfulJobs / pipelineJobs.length) * 100)
                  : null;
              const pipelineRoutines = routinesByPipelineId.get(pipeline.id) ?? [];
              const routineLabel = pipelineRoutines[0]?.name;

              return (
                <PipelineCard
                  key={pipeline.id}
                  isSavedSkill={savedPipelineIds.has(pipeline.id)}
                  isScheduled={pipelineRoutines.length > 0}
                  pipeline={pipeline}
                  routineLabel={routineLabel}
                  stats={{
                    avgDurationMs: getAverageDurationMs(pipelineJobs),
                    runs: pipelineJobs.length,
                    successRate,
                  }}
                  onOpen={handleOpenPipeline}
                  onSchedule={setSchedulingPipeline}
                />
              );
            })}
          </div>
        )}
      </div>
      {schedulingPipeline ? (
        <ScheduleEditor
          pipelineId={schedulingPipeline.id}
          pipelineName={schedulingPipeline.name}
          routine={(routinesByPipelineId.get(schedulingPipeline.id) ?? [])[0] ?? null}
          onClose={() => setSchedulingPipeline(null)}
        />
      ) : null}
    </div>
  );
};
