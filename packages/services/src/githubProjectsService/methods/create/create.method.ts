import type { createGithubProjectsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createCreateMethod =
  (dao: ReturnType<typeof createGithubProjectsDao>) =>
  async (...args: Parameters<typeof dao.create>) =>
    withMeta(await dao.create(...args));
