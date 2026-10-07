import type { createRoutinesDao } from "@repo/models";

export const createDeleteMethod = (dao: ReturnType<typeof createRoutinesDao>) => (id: string) =>
  dao.delete(id);
