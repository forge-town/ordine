import type {
  createAgentRawExportsDao,
  createAgentSpansDao,
  createJobsDao,
  createJobTracesDao,
  createPipelinesDao,
} from "@repo/models";
import type { Distillation } from "@repo/schemas";
import { stringifyForPrompt } from "./promptBuilder";

const buildJobSnapshot = async ({
  sourceId,
  jobsDao,
  jobTracesDao,
  agentRawExportsDao,
  agentSpansDao,
}: {
  sourceId: string;
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>;
  agentSpansDao: ReturnType<typeof createAgentSpansDao>;
}) => {
  const [job, traces, agentRuns, spans] = await Promise.all([
    jobsDao.findById(sourceId),
    jobTracesDao.findByJobId(sourceId),
    agentRawExportsDao.findByJobId(sourceId),
    agentSpansDao.findByJobId(sourceId),
  ]);

  return {
    kind: "job",
    job,
    traces: traces.slice(0, 60).map((trace) => ({
      level: trace.level,
      message: trace.message,
      createdAt: trace.createdAt,
    })),
    agentRuns: agentRuns.slice(0, 8).map((run) => ({
      id: run.id,
      agentRuntime: run.agentRuntime,
      agentId: run.agentId,
      modelId: run.modelId,
      tokenInput: run.tokenInput,
      tokenOutput: run.tokenOutput,
      durationMs: run.durationMs,
      status: run.status,
      createdAt: run.createdAt,
      rawPayloadPreview: stringifyForPrompt(run.rawPayload).slice(0, 8000),
    })),
    spans: spans.slice(0, 80).map((span) => ({
      spanType: span.spanType,
      name: span.name,
      status: span.status,
      durationMs: span.durationMs,
      modelId: span.modelId,
      startedAt: span.startedAt,
      finishedAt: span.finishedAt,
    })),
  };
};

const buildPipelineSnapshot = async ({
  sourceId,
  pipelinesDao,
}: {
  sourceId: string;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
}) => {
  const pipeline = await pipelinesDao.findById(sourceId);

  return {
    kind: "pipeline",
    pipeline,
  };
};

const buildManualSnapshot = ({ distillation }: { distillation: Distillation }) => ({
  kind: "manual",
  sourceLabel: distillation.sourceLabel,
  summary: distillation.summary,
  objective: distillation.config.objective,
  existingInputSnapshot: distillation.inputSnapshot,
});

export const buildSourceSnapshot = async ({
  distillation,
  jobsDao,
  jobTracesDao,
  agentRawExportsDao,
  agentSpansDao,
  pipelinesDao,
}: {
  distillation: Distillation;
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>;
  agentSpansDao: ReturnType<typeof createAgentSpansDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
}) => {
  if (distillation.sourceType === "job" && distillation.sourceId) {
    return buildJobSnapshot({
      sourceId: distillation.sourceId,
      jobsDao,
      jobTracesDao,
      agentRawExportsDao,
      agentSpansDao,
    });
  }

  if (distillation.sourceType === "pipeline" && distillation.sourceId) {
    return buildPipelineSnapshot({
      sourceId: distillation.sourceId,
      pipelinesDao,
    });
  }

  return buildManualSnapshot({ distillation });
};
