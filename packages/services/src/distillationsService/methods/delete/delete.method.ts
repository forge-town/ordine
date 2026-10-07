import type { createDistillationsDao } from "@repo/models";

export const createDeleteMethod =
  (distillationsDao: ReturnType<typeof createDistillationsDao>) => (id: string) =>
    distillationsDao.delete(id);
