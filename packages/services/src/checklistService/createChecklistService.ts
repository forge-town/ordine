import {
  createChecklistItemsDao,
  createChecklistResultsDao,
  type DbConnection,
} from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createChecklistService = (db: DbConnection) => {
  const itemsDao = createChecklistItemsDao(db);
  const resultsDao = createChecklistResultsDao(db);

  return {
    getItemsByBestPracticeId: async (bestPracticeId: string) =>
      (await itemsDao.findByBestPracticeId(bestPracticeId)).map(withMeta),
    getItemById: async (id: string) => withMeta(await itemsDao.findById(id)),
    createItem: async (...args: Parameters<typeof itemsDao.create>) =>
      withMeta(await itemsDao.create(...args)),
    updateItem: async (...args: Parameters<typeof itemsDao.update>) =>
      withMeta(await itemsDao.update(...args)),
    deleteItem: (id: string) => itemsDao.delete(id),
    getResultsByJobId: (jobId: string) => resultsDao.findByJobId(jobId),
    createResult: (...args: Parameters<typeof resultsDao.create>) => resultsDao.create(...args),
  };
};
