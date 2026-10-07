import type { createRefinementsDao } from "@repo/models";

import type { RefinementRound } from "@repo/schemas";

export const createUpdateRoundHelper =
  (dao: ReturnType<typeof createRefinementsDao>) =>
  async (
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
