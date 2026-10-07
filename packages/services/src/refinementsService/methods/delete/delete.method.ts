import type { createRefinementsDao } from "@repo/models";

export const createDeleteMethod = (dao: ReturnType<typeof createRefinementsDao>) => (id: string) =>
  dao.delete(id);
