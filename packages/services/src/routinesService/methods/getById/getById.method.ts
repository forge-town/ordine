import type { createRoutinesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createRoutinesDao>) => async (id: string) =>
    withMeta(await dao.findById(id));
