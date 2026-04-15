import type { ChecklistItemsDaoInstance, ChecklistResultsDaoInstance } from "@repo/models";

export const createChecklistService = (
  itemsDao: ChecklistItemsDaoInstance,
  resultsDao: ChecklistResultsDaoInstance,
) => ({
  getItemsByBestPracticeId: (bestPracticeId: string) =>
    itemsDao.findByBestPracticeId(bestPracticeId),
  getItemById: (id: string) => itemsDao.findById(id),
  createItem: (...args: Parameters<typeof itemsDao.create>) => itemsDao.create(...args),
  updateItem: (...args: Parameters<typeof itemsDao.update>) => itemsDao.update(...args),
  deleteItem: (id: string) => itemsDao.delete(id),
  getResultsByJobId: (jobId: string) => resultsDao.findByJobId(jobId),
  createResult: (...args: Parameters<typeof resultsDao.create>) => resultsDao.create(...args),
});
