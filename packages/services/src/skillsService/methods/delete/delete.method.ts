import type { createSkillsDao } from "@repo/models";

export const createDeleteMethod = (dao: ReturnType<typeof createSkillsDao>) => (id: string) =>
  dao.delete(id);
