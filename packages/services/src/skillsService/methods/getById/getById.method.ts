import type { createSkillsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createSkillsDao>) => async (id: string) =>
    withMeta(await dao.findById(id));
