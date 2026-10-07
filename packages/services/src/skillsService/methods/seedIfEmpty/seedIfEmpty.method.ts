import type { createSkillsDao } from "@repo/models";

export const createSeedIfEmptyMethod = (dao: ReturnType<typeof createSkillsDao>) => () =>
  dao.seedIfEmpty();
