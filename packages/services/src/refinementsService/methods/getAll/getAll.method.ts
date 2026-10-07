import type { createRefinementsDao } from "@repo/models";

export const createGetAllMethod = (dao: ReturnType<typeof createRefinementsDao>) => () =>
  dao.findMany();
