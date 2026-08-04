import type { Job, PipelineAsset, PipelineData, Routine } from "@repo/schemas";
import type { PipelineFilter } from "./_store/pipelinesPageSlice";

export interface PipelineMetrics {
  totalRuns: number;
  successRate: number | null;
  avgDurationMs: number | null;
  isSavedSkill: boolean;
  isScheduled: boolean;
}

const TERMINAL_STATUSES = new Set(["done", "failed", "cancelled", "expired", "skipped"]);

export const buildPipelineMetrics = (
  pipelineIds: string[],
  jobs: Job[],
  assets: PipelineAsset[],
  routines: Routine[],
): Map<string, PipelineMetrics> => {
  const metrics = new Map<string, PipelineMetrics>(
    pipelineIds.map((id) => [
      id,
      {
        totalRuns: 0,
        successRate: null,
        avgDurationMs: null,
        isSavedSkill: false,
        isScheduled: false,
      },
    ]),
  );
  const terminalCounts = new Map<string, number>();
  const successCounts = new Map<string, number>();
  const durationTotals = new Map<string, { total: number; count: number }>();

  for (const job of jobs) {
    const pipelineId = job.pipelineId;
    if (!pipelineId) continue;
    const value = metrics.get(pipelineId);
    if (!value || job.type !== "pipeline_run" || job.parentJobId !== null) continue;

    value.totalRuns += 1;
    if (TERMINAL_STATUSES.has(job.status)) {
      terminalCounts.set(pipelineId, (terminalCounts.get(pipelineId) ?? 0) + 1);
      if (job.status === "done") {
        successCounts.set(pipelineId, (successCounts.get(pipelineId) ?? 0) + 1);
      }
    }
    if (job.startedAt && job.finishedAt) {
      const duration = job.finishedAt.getTime() - job.startedAt.getTime();
      if (duration >= 0) {
        const aggregate = durationTotals.get(pipelineId) ?? { total: 0, count: 0 };
        aggregate.total += duration;
        aggregate.count += 1;
        durationTotals.set(pipelineId, aggregate);
      }
    }
  }

  for (const asset of assets) {
    const value = metrics.get(asset.pipelineId);
    if (value) value.isSavedSkill = true;
  }
  for (const routine of routines) {
    const value = metrics.get(routine.pipelineId);
    if (value && routine.enabled) value.isScheduled = true;
  }
  for (const [pipelineId, value] of metrics) {
    const terminalCount = terminalCounts.get(pipelineId) ?? 0;
    const duration = durationTotals.get(pipelineId);
    value.successRate = terminalCount ? (successCounts.get(pipelineId) ?? 0) / terminalCount : null;
    value.avgDurationMs = duration?.count ? Math.round(duration.total / duration.count) : null;
  }

  return metrics;
};

interface FilterPipelinesOptions {
  pipelines: PipelineData[];
  metricsByPipeline: Map<string, PipelineMetrics>;
  search: string;
  selectedTags: string[];
  currentProjectId: string | null;
  activeFilter: PipelineFilter;
}

export const filterPipelines = ({
  pipelines,
  metricsByPipeline,
  search,
  selectedTags,
  currentProjectId,
  activeFilter,
}: FilterPipelinesOptions) => {
  const query = search.trim().toLowerCase();

  return pipelines.filter((pipeline) => {
    const matchesSearch =
      !query ||
      pipeline.name.toLowerCase().includes(query) ||
      pipeline.description.toLowerCase().includes(query) ||
      pipeline.id.toLowerCase().includes(query);
    const matchesTags = selectedTags.every((tag) => pipeline.tags.includes(tag));
    const matchesProject = !currentProjectId || pipeline.projectId === currentProjectId;
    const metrics = metricsByPipeline.get(pipeline.id);
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "savedSkills" && metrics?.isSavedSkill === true) ||
      (activeFilter === "drafts" && pipeline.status === "draft") ||
      (activeFilter === "scheduled" && metrics?.isScheduled === true);

    return matchesSearch && matchesTags && matchesProject && matchesFilter;
  });
};
