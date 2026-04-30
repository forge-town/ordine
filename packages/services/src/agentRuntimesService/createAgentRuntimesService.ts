import { createAgentRuntimesDao, type DbConnection } from "@repo/models";
import { withMeta, type AgentRuntimeConfig } from "@repo/schemas";

export const createAgentRuntimesService = (db: DbConnection) => {
  const dao = createAgentRuntimesDao(db);

  return {
    getAll: async () => {
      const records = await dao.findMany();

      return records.map(withMeta);
    },
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (data: Parameters<typeof dao.create>[0]) => withMeta(await dao.create(data)),
    update: async (id: string, patch: Parameters<typeof dao.update>[1]) =>
      withMeta(await dao.update(id, patch)),
    delete: (id: string) => dao.delete(id),
    syncAll: async (incoming: AgentRuntimeConfig[]) => {
      const existing = await dao.findMany();
      const existingIds = new Set(existing.map((r) => r.id));
      const incomingIds = new Set(incoming.map((r) => r.id));

      const toCreate = incoming.filter((r) => !existingIds.has(r.id));
      const toUpdate = incoming.filter((r) => existingIds.has(r.id));
      const toDelete = existing.filter((r) => !incomingIds.has(r.id));

      await Promise.all([
        ...toCreate.map((r) => dao.create(r)),
        ...toUpdate.map((r) =>
          dao.update(r.id, { name: r.name, type: r.type, connection: r.connection }),
        ),
        ...toDelete.map((r) => dao.delete(r.id)),
      ]);

      const updated = await dao.findMany();

      return updated.map(withMeta);
    },
  };
};
