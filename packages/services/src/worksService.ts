import type { WorkEntity } from "@repo/models";

type WorkStatus = WorkEntity["status"];

type WorksDao = {
  findMany: () => Promise<WorkEntity[]>;
  findByProject: (projectId: string) => Promise<WorkEntity[]>;
  findById: (id: string) => Promise<WorkEntity | null>;
  create: (
    data: Omit<WorkEntity, "createdAt" | "updatedAt" | "startedAt" | "finishedAt">,
  ) => Promise<WorkEntity>;
  updateStatus: (
    id: string,
    status: WorkStatus,
    extra?: { logs?: string[]; startedAt?: Date; finishedAt?: Date },
  ) => Promise<WorkEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createWorksService = (dao: WorksDao) => ({
  getAll: () => dao.findMany(),
  getByProject: (projectId: string) => dao.findByProject(projectId),
  getById: (id: string) => dao.findById(id),
  create: (data: Omit<WorkEntity, "createdAt" | "updatedAt" | "startedAt" | "finishedAt">) =>
    dao.create(data),
  updateStatus: (
    id: string,
    status: WorkStatus,
    extra?: { logs?: string[]; startedAt?: Date; finishedAt?: Date },
  ) => dao.updateStatus(id, status, extra),
  delete: (id: string) => dao.delete(id),
});
