import type { createAgentsDao } from "@repo/models";

export const createDeleteMethod = (dao: ReturnType<typeof createAgentsDao>) => (id: string) =>
  dao.delete(id);
