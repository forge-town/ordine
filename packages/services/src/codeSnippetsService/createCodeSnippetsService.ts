import { createCodeSnippetsDao, type DbConnection } from "@repo/models";

export const createCodeSnippetsService = (db: DbConnection) => {
  const dao = createCodeSnippetsDao(db);

  return {
    getByBestPracticeId: (bestPracticeId: string) => dao.findByBestPracticeId(bestPracticeId),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: (id: string) => dao.delete(id),
    deleteByBestPracticeId: (bestPracticeId: string) => dao.deleteByBestPracticeId(bestPracticeId),
  };
};
