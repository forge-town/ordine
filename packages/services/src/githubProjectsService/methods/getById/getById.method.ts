import type { createGithubProjectsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createGithubProjectsDao>) => async (id: string) =>
    withMeta(await dao.findById(id));
