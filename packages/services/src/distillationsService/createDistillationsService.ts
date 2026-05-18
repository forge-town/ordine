import {
  createAgentRawExportsDao,
  createAgentSpansDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createPipelinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeDistillationRecord } from "./normalizers";
import { runDistillation } from "./runDistillation";

export const createDistillationsService = (db: DbConnection) => {
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const settingsDao = createSettingsDao(db);

  return {
    getAll: async () => {
      const records = await distillationsDao.findMany();

      return records.map((record) => withMeta(normalizeDistillationRecord(record)));
    },
    getById: async (id: string) => {
      const record = await distillationsDao.findById(id);

      if (!record) {
        return undefined;
      }

      return withMeta(normalizeDistillationRecord(record));
    },
    create: async (...args: Parameters<typeof distillationsDao.create>) =>
      withMeta(normalizeDistillationRecord(await distillationsDao.create(...args))),
    update: async (...args: Parameters<typeof distillationsDao.update>) => {
      const record = await distillationsDao.update(...args);

      return withMeta(record ? normalizeDistillationRecord(record) : undefined);
    },
    delete: (id: string) => distillationsDao.delete(id),
    run: (id: string) =>
      runDistillation({
        id,
        distillationsDao,
        jobsDao,
        jobTracesDao,
        agentRawExportsDao,
        agentSpansDao,
        pipelinesDao,
        settingsDao,
      }),
  };
};
