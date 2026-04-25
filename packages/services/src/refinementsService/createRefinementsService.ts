import { ResultAsync } from "neverthrow";
import {
  createDistillationsDao,
  createJobsDao,
  createPipelinesDao,
  createRefinementsDao,
  type DbConnection,
} from "@repo/models";
import { logger } from "@repo/logger";
import type { RefinementRound } from "@repo/schemas";
import { createPipelinesService } from "../pipelinesService";
import { createPipelineRunnerService } from "../pipelineRunnerService";
import { createDistillationsService } from "../distillationsService";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 600;

const waitForJobCompletion = async (
  jobsDao: ReturnType<typeof createJobsDao>,
  jobId: string,
): Promise<{ status: string; error?: string }> => {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const job = await jobsDao.findById(jobId);
    if (!job) return { status: "failed", error: "Job not found" };

    if (job.status === "completed") return { status: "completed" };
    if (job.status === "failed") return { status: "failed", error: job.error ?? "Job failed" };

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { status: "failed", error: "Job timed out" };
};

export const createRefinementsService = (db: DbConnection) => {
  const dao = createRefinementsDao(db);
  const jobsDao = createJobsDao(db);
  const distillationsDao = createDistillationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const pipelinesService = createPipelinesService(db);
  const pipelineRunnerService = createPipelineRunnerService(db);
  const distillationsService = createDistillationsService(db);

  const updateRound = async (
    refinementId: string,
    roundIndex: number,
    patch: Partial<RefinementRound>,
    rounds: RefinementRound[],
  ) => {
    const updated = [...rounds];
    updated[roundIndex] = { ...updated[roundIndex]!, ...patch };
    await dao.update(refinementId, { rounds: updated });
    return updated;
  };

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    delete: (id: string) => dao.delete(id),

    start: async (opts: { sourceDistillationId: string; maxRounds: number }) => {
      const sourceDistillation = await distillationsDao.findById(opts.sourceDistillationId);
      if (!sourceDistillation) return undefined;

      const id = crypto.randomUUID();
      const rounds: RefinementRound[] = Array.from({ length: opts.maxRounds }, (_, i) => ({
        round: i + 1,
        pipelineId: null,
        jobId: null,
        distillationId: null,
        status: "pending",
        summary: "",
        error: null,
      }));

      const refinement = await dao.create({
        id,
        sourceDistillationId: opts.sourceDistillationId,
        maxRounds: opts.maxRounds,
        currentRound: 0,
        status: "running",
        rounds,
      });

      void runLoop(id, opts.sourceDistillationId, rounds);

      return refinement;
    },
  };

  async function runLoop(
    refinementId: string,
    initialDistillationId: string,
    initialRounds: RefinementRound[],
  ) {
    let currentDistillationId = initialDistillationId;
    let rounds = [...initialRounds];

    const result = await ResultAsync.fromPromise(
      (async () => {
        for (let i = 0; i < rounds.length; i++) {
          await dao.update(refinementId, { currentRound: i + 1 });

          rounds = await updateRound(refinementId, i, { status: "optimizing" }, rounds);

          const optimized = await pipelinesService.optimizeFromDistillation({
            distillationId: currentDistillationId,
            userPrompt: `Refinement round ${i + 1}/${rounds.length}. Focus on the most impactful improvements from the distillation report.`,
          });
          if (!optimized) {
            rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: "Pipeline optimization returned empty" },
              rounds,
            );
            continue;
          }

          const savedPipeline = await pipelinesDao.findById(optimized.id);
          if (!savedPipeline) {
            rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: "Optimized pipeline not found after creation" },
              rounds,
            );
            continue;
          }

          rounds = await updateRound(
            refinementId,
            i,
            { pipelineId: optimized.id, status: "running" },
            rounds,
          );

          const runResult = await pipelineRunnerService.startRun({
            pipelineId: optimized.id,
          });

          if (runResult.isErr()) {
            rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: `Run failed: ${runResult.error.message}` },
              rounds,
            );
            continue;
          }

          const { jobId } = runResult.value;
          rounds = await updateRound(refinementId, i, { jobId }, rounds);

          const jobResult = await waitForJobCompletion(jobsDao, jobId);
          if (jobResult.status === "failed") {
            rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: jobResult.error ?? "Job failed" },
              rounds,
            );
            continue;
          }

          rounds = await updateRound(refinementId, i, { status: "distilling" }, rounds);

          const newDistillationId = crypto.randomUUID();
          await distillationsDao.create({
            id: newDistillationId,
            title: `Refinement R${i + 1} distillation`,
            summary: "",
            sourceType: "job",
            sourceId: jobId,
            sourceLabel: `Refinement round ${i + 1}`,
            mode: "auto",
            status: "pending",
            config: sourceDistillationConfig(),
            inputSnapshot: null,
            result: null,
          });

          const distResult = await distillationsService.run(newDistillationId);

          rounds = await updateRound(
            refinementId,
            i,
            {
              distillationId: newDistillationId,
              status: "completed",
              summary:
                distResult && typeof distResult === "object" && "summary" in distResult
                  ? String((distResult as Record<string, unknown>).summary ?? "")
                  : "",
            },
            rounds,
          );

          currentDistillationId = newDistillationId;
        }
      })(),
      (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
    );

    result.match(
      async () => {
        await dao.update(refinementId, { status: "completed" });
        logger.info({ refinementId }, "Refinement loop completed");
      },
      async (error) => {
        logger.error({ err: error, refinementId }, "Refinement loop failed");
        await dao.update(refinementId, { status: "failed" });
      },
    );
  }

  function sourceDistillationConfig() {
    return { objective: "Distill insights from refinement round for next optimization." };
  }
};
