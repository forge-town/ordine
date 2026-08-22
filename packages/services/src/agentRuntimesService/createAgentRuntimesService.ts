import { createAgentRuntimesDao, type DbConnection } from "@repo/models";
import { mapWithMeta, withMeta, type AgentRuntimeConfig } from "@repo/schemas";

export const createAgentRuntimesService = (db: DbConnection) => {
  const dao = createAgentRuntimesDao(db);

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (data: Parameters<typeof dao.create>[0]) => withMeta(await dao.create(data)),
    update: async (id: string, patch: Parameters<typeof dao.update>[1]) =>
      withMeta(await dao.update(id, patch)),
    delete: (id: string) => dao.delete(id),
    syncAll: async (incoming: AgentRuntimeConfig[]) => {
      const existing = await dao.findMany();
      const existingIds = new Set(existing.map((r) => r.id));
      const toCreate = incoming.filter((r) => !existingIds.has(r.id));
      const toUpdate = incoming.filter((r) => existingIds.has(r.id));
      // Runtime discovery is evidence, not a destructive source of truth. A CLI can disappear
      // temporarily because a desktop-launched process inherited a different PATH, so rescan only
      // upserts positive detections and keeps missing local/manual/remote configurations intact.

      await Promise.all([
        ...toCreate.map((r) => dao.create(r)),
        ...toUpdate.map((r) => {
          const existingRuntime = existing.find((runtime) => runtime.id === r.id);
          const connection =
            r.connection.mode === "local" &&
            existingRuntime?.connection.mode === "local" &&
            r.connection.models === undefined &&
            existingRuntime.connection.models !== undefined
              ? { ...r.connection, models: existingRuntime.connection.models }
              : r.connection;

          return dao.update(r.id, { name: r.name, type: r.type, connection });
        }),
      ]);

      const updated = await dao.findMany();

      return mapWithMeta(updated);
    },
  };
};
