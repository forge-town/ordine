import { createCodeSnippetsDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createCodeSnippetsService = (db: DbConnection) => {
  const dao = createCodeSnippetsDao(db);

  return {
    getByBestPracticeId: async (bestPracticeId: string) =>
      (await dao.findByBestPracticeId(bestPracticeId)).map(withMeta),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
    deleteByBestPracticeId: (bestPracticeId: string) => dao.deleteByBestPracticeId(bestPracticeId),
  };
};
