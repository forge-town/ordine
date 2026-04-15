import type { JobEntity } from "@repo/models";

type JobStatus = JobEntity["status"];

type JobsDao = {
  findMany: (filter?: { status?: JobStatus; projectId?: string }) => Promise<JobEntity[]>;
  findById: (id: string) => Promise<JobEntity | null>;
  create: (data: Omit<JobEntity, "createdAt" | "updatedAt">) => Promise<JobEntity>;
  updateStatus: (
    id: string,
    status: JobStatus,
    extra?: {
      logs?: string[];
      error?: string;
      result?: JobEntity["result"];
      startedAt?: number;
      finishedAt?: number;
    },
  ) => Promise<JobEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createJobsService = (dao: JobsDao) => ({
  getAll: (filter?: { status?: JobStatus; projectId?: string }) => dao.findMany(filter),
  getById: (id: string) => dao.findById(id),
  create: (data: Omit<JobEntity, "createdAt" | "updatedAt">) => dao.create(data),
  updateStatus: (
    id: string,
    status: JobStatus,
    extra?: {
      logs?: string[];
      error?: string;
      result?: JobEntity["result"];
      startedAt?: number;
      finishedAt?: number;
    },
  ) => dao.updateStatus(id, status, extra),
  delete: (id: string) => dao.delete(id),
});
