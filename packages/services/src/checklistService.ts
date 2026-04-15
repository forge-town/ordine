import type { ChecklistItemEntity, ChecklistResultEntity } from "@repo/models";

type ChecklistItemsDao = {
  findByBestPracticeId: (bestPracticeId: string) => Promise<ChecklistItemEntity[]>;
  findById: (id: string) => Promise<ChecklistItemEntity | null>;
  create: (
    data: Omit<ChecklistItemEntity, "createdAt" | "updatedAt">,
  ) => Promise<ChecklistItemEntity>;
  update: (
    id: string,
    patch: Partial<Omit<ChecklistItemEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>,
  ) => Promise<ChecklistItemEntity | null>;
  delete: (id: string) => Promise<void>;
};

type ChecklistResultsDao = {
  findByJobId: (jobId: string) => Promise<ChecklistResultEntity[]>;
  create: (data: Omit<ChecklistResultEntity, "createdAt">) => Promise<ChecklistResultEntity>;
};

export const createChecklistService = (
  itemsDao: ChecklistItemsDao,
  resultsDao: ChecklistResultsDao,
) => ({
  getItemsByBestPracticeId: (bestPracticeId: string) =>
    itemsDao.findByBestPracticeId(bestPracticeId),
  getItemById: (id: string) => itemsDao.findById(id),
  createItem: (data: Omit<ChecklistItemEntity, "createdAt" | "updatedAt">) => itemsDao.create(data),
  updateItem: (
    id: string,
    patch: Partial<Omit<ChecklistItemEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>,
  ) => itemsDao.update(id, patch),
  deleteItem: (id: string) => itemsDao.delete(id),
  getResultsByJobId: (jobId: string) => resultsDao.findByJobId(jobId),
  createResult: (data: Omit<ChecklistResultEntity, "createdAt">) => resultsDao.create(data),
});
