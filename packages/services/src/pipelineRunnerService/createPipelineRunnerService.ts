import { initObs } from "@repo/obs";
import { createLlmService } from "../llmService";
import { createLoopEvaluator } from "./loopEvaluator";
import { buildEngineDeps } from "./engineDeps";
import { runPipeline } from "./runPipeline";
import {
  createOperationsDao,
  createPipelinesDao,
  createJobsDao,
  createJobTracesDao,
  createSkillsDao,
  createBestPracticesDao,
  createRulesDao,
  type DbConnection,
} from "@repo/models";

export const createPipelineRunnerService = (db: DbConnection) => {
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const skillsDao = createSkillsDao(db);
  const bestPracticesDao = createBestPracticesDao(db);
  const rulesDao = createRulesDao(db);

  initObs(jobTracesDao);
  const llmService = createLlmService(db);
  const { getSettings, getModel } = llmService;

  const loopEvaluatorFactory = createLoopEvaluator(getModel);

  const buildDepsForJob = (jobId: string) =>
    buildEngineDeps(getSettings, rulesDao, loopEvaluatorFactory(jobId));

  const startRun = async (opts: {
    pipelineId: string;
    inputPath?: string;
    githubToken?: string;
  }): Promise<{ jobId: string }> => {
    const pipeline = await pipelinesDao.findById(opts.pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${opts.pipelineId} not found`);
    }

    const jobId = crypto.randomUUID();
    await jobsDao.create({
      id: jobId,
      title: `Run: ${pipeline.name}`,
      type: "pipeline_run",
      pipelineId: opts.pipelineId,
      projectId: null,
      logs: [],
      result: null,
      error: null,
      status: "queued",
      startedAt: null,
      finishedAt: null,
    });

    void runPipeline({
      pipelineId: opts.pipelineId,
      inputPath: opts.inputPath,
      githubToken: opts.githubToken,
      jobId,
      pipelinesDao,
      operationsDao,
      jobsDao,
      skillsDao,
      bestPracticesDao,
      engineDeps: buildDepsForJob(jobId),
    });

    return { jobId };
  };

  return {
    runPipeline: (opts: {
      pipelineId: string;
      inputPath?: string;
      jobId: string;
      githubToken?: string;
    }) =>
      runPipeline({
        ...opts,
        pipelinesDao,
        operationsDao,
        jobsDao,
        skillsDao,
        bestPracticesDao,
        engineDeps: buildDepsForJob(opts.jobId),
      }),
    startRun,
  };
};
