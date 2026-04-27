import type { Distillation, Job } from "@repo/schemas";
import type { PipelineData } from "@repo/pipeline-engine/schemas";

const ACTIVITY_DAYS = 7;
const MAX_PIPELINE_ROWS = 6;
const MAX_RECENT_DISTILLATIONS = 4;

export type DashboardActivityDatum = {
  label: string;
  total: number;
  done: number;
  failed: number;
  running: number;
};

export type DashboardStatusDatum = {
  key: string;
  label: string;
  value: number;
};

export type DashboardPipelineDatum = {
  id: string;
  name: string;
  runs: number;
  failed: number;
  done: number;
};

export type DashboardArtifactDatum = {
  label: string;
  value: number;
};

export type DashboardSnapshotMetric = {
  label: string;
  value: string;
  hint: string;
};

export type DashboardDistillationPreview = {
  id: string;
  title: string;
  status: Distillation["status"];
  mode: Distillation["mode"];
  summary: string;
};

export type DashboardMetrics = {
  activity: DashboardActivityDatum[];
  statuses: DashboardStatusDatum[];
  pipelines: DashboardPipelineDatum[];
  artifactMix: DashboardArtifactDatum[];
  snapshot: DashboardSnapshotMetric[];
  recentJobs: Job[];
  recentDistillations: DashboardDistillationPreview[];
};

const getDayKey = (date: Date) => date.toISOString().slice(0, 10);

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
  });

const getJobDate = (job: Job) => {
  if (job.meta?.createdAt instanceof Date) {
    return new Date(job.meta.createdAt);
  }

  if (job.meta?.createdAt) {
    return new Date(job.meta.createdAt);
  }

  return new Date();
};

const getDistillationDate = (distillation: Distillation) => {
  if (distillation.meta?.createdAt instanceof Date) {
    return new Date(distillation.meta.createdAt);
  }

  if (distillation.meta?.createdAt) {
    return new Date(distillation.meta.createdAt);
  }

  return new Date();
};

const countReusableAssets = (distillations: Distillation[]) =>
  distillations.reduce((total, distillation) => {
    if (distillation.result?.type !== "completed") {
      return total;
    }

    return total + distillation.result.reusableAssets.length;
  }, 0);

const buildActivity = (jobs: Job[]): DashboardActivityDatum[] => {
  const today = new Date();
  const buckets = new Map<string, DashboardActivityDatum>();

  for (const offset of Array.from(
    { length: ACTIVITY_DAYS },
    (_, index) => ACTIVITY_DAYS - 1 - index
  )) {
    const bucketDate = new Date(today);
    bucketDate.setHours(0, 0, 0, 0);
    bucketDate.setDate(today.getDate() - offset);
    const key = getDayKey(bucketDate);

    buckets.set(key, {
      label: formatDayLabel(bucketDate),
      total: 0,
      done: 0,
      failed: 0,
      running: 0,
    });
  }

  for (const job of jobs) {
    const createdAt = getJobDate(job);
    createdAt.setHours(0, 0, 0, 0);
    const key = getDayKey(createdAt);
    const bucket = buckets.get(key);

    if (!bucket) {
      continue;
    }

    bucket.total += 1;

    if (job.status === "done") {
      bucket.done += 1;
    }

    if (job.status === "failed") {
      bucket.failed += 1;
    }

    if (job.status === "running" || job.status === "queued") {
      bucket.running += 1;
    }
  }

  return [...buckets.values()];
};

const buildStatuses = (jobs: Job[]): DashboardStatusDatum[] => {
  const grouped = {
    running: 0,
    queued: 0,
    done: 0,
    failed: 0,
  };

  for (const job of jobs) {
    if (job.status in grouped) {
      grouped[job.status as keyof typeof grouped] += 1;
    }
  }

  return [
    { key: "running", label: "Running", value: grouped.running },
    { key: "queued", label: "Queued", value: grouped.queued },
    { key: "done", label: "Done", value: grouped.done },
    { key: "failed", label: "Failed", value: grouped.failed },
  ];
};

const buildPipelineRows = (jobs: Job[], pipelines: PipelineData[]): DashboardPipelineDatum[] => {
  const pipelineNames = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name]));
  const grouped = new Map<string, DashboardPipelineDatum>();

  for (const job of jobs) {
    if (!job.pipelineId) {
      continue;
    }

    const pipeline = grouped.get(job.pipelineId) ?? {
      id: job.pipelineId,
      name: pipelineNames.get(job.pipelineId) ?? job.pipelineId,
      runs: 0,
      failed: 0,
      done: 0,
    };

    pipeline.runs += 1;

    if (job.status === "failed") {
      pipeline.failed += 1;
    }

    if (job.status === "done") {
      pipeline.done += 1;
    }

    grouped.set(job.pipelineId, pipeline);
  }

  return [...grouped.values()]
    .sort((left, right) => right.runs - left.runs)
    .slice(0, MAX_PIPELINE_ROWS);
};

const buildArtifactMix = (distillations: Distillation[]): DashboardArtifactDatum[] => {
  const grouped = {
    prompt_patch: 0,
    pipeline_template: 0,
    failure_pattern: 0,
    knowledge_card: 0,
  };

  for (const distillation of distillations) {
    if (distillation.result?.type !== "completed") {
      continue;
    }

    for (const asset of distillation.result.reusableAssets) {
      grouped[asset.type] += 1;
    }
  }

  return [
    { label: "Prompt Patches", value: grouped.prompt_patch },
    { label: "Pipeline Templates", value: grouped.pipeline_template },
    { label: "Failure Patterns", value: grouped.failure_pattern },
    { label: "Knowledge Cards", value: grouped.knowledge_card },
  ];
};

const buildSnapshot = (
  jobs: Job[],
  pipelines: PipelineData[],
  projectsCount: number,
  distillations: Distillation[]
): DashboardSnapshotMetric[] => {
  const completedJobs = jobs.filter((job) => job.status === "done").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const terminalJobs = completedJobs + failedJobs;
  const successRate = terminalJobs === 0 ? 0 : Math.round((completedJobs / terminalJobs) * 100);
  const activePipelines = new Set(jobs.map((job) => job.pipelineId).filter(Boolean)).size;
  const reusableAssets = countReusableAssets(distillations);

  return [
    {
      label: "Projects",
      value: String(projectsCount),
      hint: "Connected repositories",
    },
    {
      label: "Pipeline Coverage",
      value: `${activePipelines}/${pipelines.length || 0}`,
      hint: "Pipelines touched by recent jobs",
    },
    {
      label: "Success Rate",
      value: `${successRate}%`,
      hint: `${completedJobs} done / ${failedJobs} failed`,
    },
    {
      label: "Reusable Assets",
      value: String(reusableAssets),
      hint: `${distillations.length} distillations recorded`,
    },
  ];
};

const buildRecentDistillations = (distillations: Distillation[]): DashboardDistillationPreview[] =>
  [...distillations]
    .sort(
      (left, right) => getDistillationDate(right).getTime() - getDistillationDate(left).getTime()
    )
    .slice(0, MAX_RECENT_DISTILLATIONS)
    .map((distillation) => ({
      id: distillation.id,
      title: distillation.title,
      status: distillation.status,
      mode: distillation.mode,
      summary:
        distillation.summary ||
        (distillation.result?.type === "completed" ? distillation.result.summary : ""),
    }));

export const buildDashboardMetrics = (
  jobs: Job[],
  pipelines: PipelineData[],
  projectsCount: number,
  distillations: Distillation[]
): DashboardMetrics => ({
  activity: buildActivity(jobs),
  statuses: buildStatuses(jobs),
  pipelines: buildPipelineRows(jobs, pipelines),
  artifactMix: buildArtifactMix(distillations),
  snapshot: buildSnapshot(jobs, pipelines, projectsCount, distillations),
  recentJobs: [...jobs]
    .sort((left, right) => getJobDate(right).getTime() - getJobDate(left).getTime())
    .slice(0, 8),
  recentDistillations: buildRecentDistillations(distillations),
});
