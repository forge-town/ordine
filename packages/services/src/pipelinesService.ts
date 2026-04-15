import type { PipelineEntity } from "@repo/models";

type PipelinesDao = {
  findMany: () => Promise<PipelineEntity[]>;
  findById: (id: string) => Promise<PipelineEntity | null>;
  create: (
    data: Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">,
  ) => Promise<PipelineEntity>;
  update: (
    id: string,
    patch: Partial<Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">>,
  ) => Promise<PipelineEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createPipelinesService = (dao: PipelinesDao) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  create: (data: Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">) => dao.create(data),
  update: (
    id: string,
    patch: Partial<Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">>,
  ) => dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
});
