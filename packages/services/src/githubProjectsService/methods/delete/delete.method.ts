import type { createGithubProjectsDao } from "@repo/models";

export const createDeleteMethod =
  (dao: ReturnType<typeof createGithubProjectsDao>) => (id: string) =>
    dao.delete(id);
