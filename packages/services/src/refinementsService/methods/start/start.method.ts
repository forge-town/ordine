import type { createDistillationsDao, createRefinementsDao } from "@repo/models";

import type { RefinementRound } from "@repo/schemas";

import type { createRunLoopHelper } from "../../helpers/runLoop";
export const createStartMethod =
  (
    dao: ReturnType<typeof createRefinementsDao>,
    distillationsDao: ReturnType<typeof createDistillationsDao>,
    runLoop: ReturnType<typeof createRunLoopHelper>,
  ) =>
  async (opts: { sourceDistillationId: string; maxRounds: number }) => {
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
  };
