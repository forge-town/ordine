import type { createSkillsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createUpdateMethod =
  (dao: ReturnType<typeof createSkillsDao>) =>
  async (id: string, patch: Parameters<typeof dao.update>[1]) =>
    withMeta(await dao.update(id, { ...patch, origin: "manual" }));
