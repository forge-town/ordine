import { createAgentRuntimesDao, type DbConnection } from "@repo/models";
import {
  LOCAL_AGENT_RUNTIME_ID_PREFIX,
  mapWithMeta,
  withMeta,
  type AgentRuntimeConfig,
} from "@repo/schemas";

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
      const incomingIds = new Set(incoming.map((r) => r.id));

      const toCreate = incoming.filter((r) => !existingIds.has(r.id));
      const toUpdate = incoming.filter((r) => existingIds.has(r.id));
      // syncAll 的调用方(daemon 定时推送、Web 端 scanAndSync)只上报本地扫描结果,
      // 因此删除必须同时满足两个条件(COD-336):
      // 1. 本轮上报非空 —— 空结果意味着扫描失败/PATH 漂移,清空列表会让 agent"时有时无";
      // 2. 只删 local- 前缀的记录 —— 远程/手动添加的 runtime 永不被同步误删。
      const toDelete =
        incoming.length === 0
          ? []
          : existing.filter(
              (r) => r.id.startsWith(LOCAL_AGENT_RUNTIME_ID_PREFIX) && !incomingIds.has(r.id),
            );

      await Promise.all([
        ...toCreate.map((r) => dao.create(r)),
        ...toUpdate.map((r) =>
          dao.update(r.id, { name: r.name, type: r.type, connection: r.connection }),
        ),
        ...toDelete.map((r) => dao.delete(r.id)),
      ]);

      const updated = await dao.findMany();

      return mapWithMeta(updated);
    },
  };
};
