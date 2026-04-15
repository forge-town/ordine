import type { GithubProjectEntity } from "@repo/models";

type GithubProjectsDao = {
  findMany: () => Promise<GithubProjectEntity[]>;
  findById: (id: string) => Promise<GithubProjectEntity | null>;
  create: (
    data: Omit<GithubProjectEntity, "createdAt" | "updatedAt">,
  ) => Promise<GithubProjectEntity>;
  update: (
    id: string,
    patch: Partial<Omit<GithubProjectEntity, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<GithubProjectEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createGithubProjectsService = (dao: GithubProjectsDao) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  create: (data: Omit<GithubProjectEntity, "createdAt" | "updatedAt">) => dao.create(data),
  update: (
    id: string,
    patch: Partial<Omit<GithubProjectEntity, "id" | "createdAt" | "updatedAt">>,
  ) => dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
});
