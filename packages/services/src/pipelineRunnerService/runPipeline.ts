import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import {
  pipelineEngine,
  ScriptExecutionError,
  type PipelineEngineDeps,
  type PipelineRunError,
  type OperationInfo,
} from "@repo/pipeline-engine";
import type {
  OperationsDaoInstance,
  PipelinesDaoInstance,
  JobsDaoInstance,
  SkillsDaoInstance,
  BestPracticesDaoInstance,
} from "@repo/models";

export const runPipeline = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
  githubToken?: string;
  pipelinesDao: PipelinesDaoInstance;
  operationsDao: OperationsDaoInstance;
  jobsDao: JobsDaoInstance;
  skillsDao: SkillsDaoInstance;
  bestPracticesDao: BestPracticesDaoInstance;
  engineDeps: PipelineEngineDeps;
}): Promise<void> => {
  const {
    pipelineId,
    jobId,
    githubToken,
    pipelinesDao,
    operationsDao,
    jobsDao,
    skillsDao,
    bestPracticesDao,
    engineDeps,
  } = opts;

  await jobsDao.updateStatus(jobId, "running", { startedAt: new Date() });
  await trace(jobId, `Starting pipeline ${pipelineId}`);

  const pipeline = await pipelinesDao.findById(pipelineId);
  if (!pipeline) {
    await trace(jobId, `ERROR: Pipeline ${pipelineId} not found`);
    await jobsDao.updateStatus(jobId, "failed", {
      finishedAt: new Date(),
      error: `Pipeline ${pipelineId} not found`,
    });
    return;
  }

  const operationIds = pipeline.nodes
    .filter((n) => n.type === "operation")
    .map((n) => (n.data as unknown as { operationId?: string }).operationId)
    .filter((id): id is string => id !== undefined && id !== null && id !== "");

  const operationsMap = new Map<string, OperationInfo>();
  for (const id of operationIds) {
    const op = await operationsDao.findById(id);
    if (op) operationsMap.set(id, { id: op.id, name: op.name, config: op.config });
  }

  const lookupSkill = async (skillId: string) => {
    const skill = (await skillsDao.findById(skillId)) ?? (await skillsDao.findByName(skillId));
    return skill ? { id: skill.id, label: skill.label, description: skill.description } : null;
  };

  const lookupBestPractice = async (bpId: string) => {
    const bp = await bestPracticesDao.findById(bpId);
    return bp ? { title: bp.title, content: bp.content } : null;
  };

  const result = await ResultAsync.fromPromise(
    pipelineEngine.execute({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      },
      jobId,
      inputPath: opts.inputPath,
      githubToken,
      operations: operationsMap,
      deps: engineDeps,
      lookupSkill,
      lookupBestPractice,
    }),
    (cause) =>
      new ScriptExecutionError(
        cause instanceof Error ? cause.message : String(cause),
        cause,
      ) as PipelineRunError,
  );

  const outcome = result.isOk() ? result.value : { ok: false as const, error: result.error };

  if (outcome.ok) {
    await jobsDao.updateStatus(jobId, "done", {
      finishedAt: new Date(),
      result: { summary: outcome.summary },
    });
  } else {
    const message = outcome.error.message;
    await trace(jobId, `ERROR: ${message}`, "error");
    await jobsDao.updateStatus(jobId, "failed", {
      finishedAt: new Date(),
      error: message,
    });
  }
};
