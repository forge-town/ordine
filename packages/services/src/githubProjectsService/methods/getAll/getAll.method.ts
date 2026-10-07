import type { createGithubProjectsDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod = (dao: ReturnType<typeof createGithubProjectsDao>) => async () =>
  mapWithMeta(await dao.findMany());
