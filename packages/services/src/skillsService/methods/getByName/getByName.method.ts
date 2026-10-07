import type { createSkillsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByNameMethod =
  (dao: ReturnType<typeof createSkillsDao>) => async (name: string) =>
    withMeta(await dao.findByName(name));
