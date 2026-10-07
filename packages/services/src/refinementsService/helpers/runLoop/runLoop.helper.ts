import { ResultAsync } from "neverthrow";
import type {
  createDistillationsDao,
  createJobsDao,
  createPipelinesDao,
  createRefinementsDao,
} from "@repo/models";
import { logger } from "@repo/logger";
import type { RefinementRound } from "@repo/schemas";
import type { createPipelinesService } from "../../../pipelinesService";
import type { createPipelineRunnerService } from "../../../pipelineRunnerService";
import type { createDistillationsService } from "../../../distillationsService";
import { waitForJobCompletion } from "../waitForJobCompletion";
import { sourceDistillationConfig } from "../sourceDistillationConfig";
import type { createUpdateRoundHelper } from "../updateRound";
export const createRunLoopHelper =
  (
    dao: ReturnType<typeof createRefinementsDao>,
    jobsDao: ReturnType<typeof createJobsDao>,
    distillationsDao: ReturnType<typeof createDistillationsDao>,
    pipelinesDao: ReturnType<typeof createPipelinesDao>,
    pipelinesService: ReturnType<typeof createPipelinesService>,
    pipelineRunnerService: ReturnType<typeof createPipelineRunnerService>,
    distillationsService: ReturnType<typeof createDistillationsService>,
    updateRound: ReturnType<typeof createUpdateRoundHelper>,
  ) =>
  async (refinementId: string, initialDistillationId: string, initialRounds: RefinementRound[]) => {
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
  };
