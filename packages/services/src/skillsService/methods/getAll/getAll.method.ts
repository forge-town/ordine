import type { createSkillsDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod = (dao: ReturnType<typeof createSkillsDao>) => async () =>
  mapWithMeta(await dao.findMany());
