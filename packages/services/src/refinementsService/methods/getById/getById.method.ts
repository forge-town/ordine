import type { createRefinementsDao } from "@repo/models";

export const createGetByIdMethod = (dao: ReturnType<typeof createRefinementsDao>) => (id: string) =>
  dao.findById(id);
