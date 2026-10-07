import type { createGithubProjectsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createUpdateMethod =
  (dao: ReturnType<typeof createGithubProjectsDao>) =>
  async (...args: Parameters<typeof dao.update>) =>
    withMeta(await dao.update(...args));
