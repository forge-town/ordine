import type { createRoutinesDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetByPipelineIdMethod =
  (dao: ReturnType<typeof createRoutinesDao>) => async (pipelineId: string) =>
    mapWithMeta(await dao.findManyByPipelineId(pipelineId));
