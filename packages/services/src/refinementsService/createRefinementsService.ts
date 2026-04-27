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
  for (const _ of Array.from({ length: MAX_POLL_ATTEMPTS })) {
    const job = await jobsDao.findById(jobId);
    if (!job) return { status: "failed", error: "Job not found" };

    if (job.status === "done") return { status: "completed" };
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
    const state = { currentDistillationId: initialDistillationId, rounds: [...initialRounds] };

    const result = await ResultAsync.fromPromise(
      (async () => {
        for (const [i] of initialRounds.entries()) {
          await dao.update(refinementId, { currentRound: i + 1 });

          state.rounds = await updateRound(refinementId, i, { status: "optimizing" }, state.rounds);

          const optimized = await pipelinesService.optimizeFromDistillation({
            distillationId: state.currentDistillationId,
            userPrompt: `Refinement round ${i + 1}/${state.rounds.length}. Focus on the most impactful improvements from the distillation report.`,
          });
          if (!optimized) {
            state.rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: "Pipeline optimization returned empty" },
              state.rounds,
            );
            continue;
          }

          const savedPipeline = await pipelinesDao.findById(optimized.id);
          if (!savedPipeline) {
            state.rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: "Optimized pipeline not found after creation" },
              state.rounds,
            );
            continue;
          }

          state.rounds = await updateRound(
            refinementId,
            i,
            { pipelineId: optimized.id, status: "running" },
            state.rounds,
          );

          const runResult = await pipelineRunnerService.startRun({
            pipelineId: optimized.id,
          });

          if (runResult.isErr()) {
            state.rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: `Run failed: ${runResult.error.message}` },
              state.rounds,
            );
            continue;
          }

          const { jobId } = runResult.value;
          state.rounds = await updateRound(refinementId, i, { jobId }, state.rounds);

          const jobResult = await waitForJobCompletion(jobsDao, jobId);
          if (jobResult.status === "failed") {
            state.rounds = await updateRound(
              refinementId,
              i,
              { status: "failed", error: jobResult.error ?? "Job failed" },
              state.rounds,
            );
            continue;
          }

          state.rounds = await updateRound(refinementId, i, { status: "distilling" }, state.rounds);

          const newDistillationId = crypto.randomUUID();
          await distillationsDao.create({
            id: newDistillationId,
            title: `Refinement R${i + 1} distillation`,
            summary: "",
            sourceType: "job",
            sourceId: jobId,
            sourceLabel: `Refinement round ${i + 1}`,
            mode: "pipeline",
            status: "draft",
            config: sourceDistillationConfig(),
            inputSnapshot: null,
            result: null,
          });

          const distResult = await distillationsService.run(newDistillationId);

          state.rounds = await updateRound(
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
            state.rounds,
          );

          state.currentDistillationId = newDistillationId;
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
