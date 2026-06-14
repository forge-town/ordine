import { trpcClient } from "@/integrations/trpc/client";
import { ResourceName } from "./resourceNames";
import type { ResourceHandlers } from "./types";

/**
 * 资源 → handler 注册表（H3-03）。逐条等价迁移自原 dataProvider 的 5 个 switch，
 * 行为零变化：trpc 调用、参数映射、id String() 归一全部照搬。
 *
 * 类型 cast（`as Parameters<...>`）保持与原实现一致——trpc 输入是强类型，
 * 而 Refine 的 variables/patch 是 unknown，cast 边界与迁移前完全相同。
 */

type Vars = Record<string, unknown>;
const asRecord = (variables: unknown): Vars => variables as Vars;

export const resourceHandlers: Partial<Record<string, ResourceHandlers>> = {
  [ResourceName.agents]: {
    getList: () => trpcClient.agents.getMany.query(),
    getOne: (id) => trpcClient.agents.getById.query({ id }),
    create: (v) =>
      trpcClient.agents.create.mutate(v as Parameters<typeof trpcClient.agents.create.mutate>[0]),
    update: (id, v) =>
      trpcClient.agents.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.agents.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.agents.delete.mutate({ id }),
  },

  [ResourceName.agentRuntimes]: {
    getList: () => trpcClient.agentRuntimes.getMany.query(),
    getOne: (id) => trpcClient.agentRuntimes.getById.query({ id }),
    create: (v) =>
      trpcClient.agentRuntimes.create.mutate(
        v as Parameters<typeof trpcClient.agentRuntimes.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.agentRuntimes.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.agentRuntimes.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.agentRuntimes.delete.mutate({ id }),
  },

  [ResourceName.annotations]: {
    getList: (_params, f) =>
      trpcClient.annotations.getMany.query({
        pipelineId: f.string("pipelineId"),
        targetId: f.string("targetId"),
      }),
    getOne: (id) => trpcClient.annotations.getById.query({ id }),
    create: (v) =>
      trpcClient.annotations.create.mutate(
        v as Parameters<typeof trpcClient.annotations.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.annotations.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.annotations.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.annotations.delete.mutate({ id }),
  },

  [ResourceName.connectors]: {
    getList: () => trpcClient.connectors.getMany.query(),
    getOne: (id) => trpcClient.connectors.getById.query({ id }),
    create: (v) =>
      trpcClient.connectors.create.mutate(
        v as Parameters<typeof trpcClient.connectors.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.connectors.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.connectors.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.connectors.delete.mutate({ id }),
  },

  [ResourceName.conversationMessages]: {
    getList: (_params, f) =>
      trpcClient.conversations.getMany.query({
        pipelineId: f.string("pipelineId"),
        limit: f.number("limit"),
      }),
    getOne: (id) => trpcClient.conversations.getById.query({ id }),
    create: (v) =>
      trpcClient.conversations.create.mutate(
        v as Parameters<typeof trpcClient.conversations.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.conversations.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.conversations.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.conversations.delete.mutate({ id }),
  },

  [ResourceName.filesystem]: {
    getList: (_params, f) => trpcClient.filesystem.browse.query({ path: f.string("path") }),
  },

  [ResourceName.operations]: {
    getList: () => trpcClient.operations.getMany.query(),
    getOne: (id) => trpcClient.operations.getById.query({ id }),
    create: (v) =>
      trpcClient.operations.create.mutate(
        v as Parameters<typeof trpcClient.operations.create.mutate>[0],
      ),
    // operations 用展开而非 patch（与迁移前一致）。
    update: (id, v) =>
      trpcClient.operations.update.mutate({ id, ...asRecord(v) } as Parameters<
        typeof trpcClient.operations.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.operations.delete.mutate({ id }),
  },

  [ResourceName.pipelineAssets]: {
    getList: (_params, f) =>
      trpcClient.pipelineAssets.getMany.query({ pipelineId: f.string("pipelineId") }),
    getOne: (id) => trpcClient.pipelineAssets.getById.query({ id }),
    create: (v) =>
      trpcClient.pipelineAssets.create.mutate(
        v as Parameters<typeof trpcClient.pipelineAssets.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.pipelineAssets.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.pipelineAssets.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.pipelineAssets.delete.mutate({ id }),
  },

  [ResourceName.pipelines]: {
    getList: () => trpcClient.pipelines.getMany.query(),
    getOne: (id) => trpcClient.pipelines.getById.query({ id }),
    // pipelines.create 把 pendingOperations 从图数据里拆出（与迁移前一致）。
    create: (v) => {
      const { pendingOperations, ...pipelineData } = asRecord(v);

      return trpcClient.pipelines.create.mutate({
        pipeline: pipelineData,
        pendingOperations: pendingOperations as
          | Parameters<typeof trpcClient.pipelines.create.mutate>[0]["pendingOperations"]
          | undefined,
      } as Parameters<typeof trpcClient.pipelines.create.mutate>[0]);
    },
    update: (id, v) =>
      trpcClient.pipelines.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.pipelines.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.pipelines.delete.mutate({ id }),
  },

  [ResourceName.projects]: {
    getList: () => trpcClient.projects.getMany.query(),
    getOne: (id) => trpcClient.projects.getById.query({ id }),
    create: (v) =>
      trpcClient.projects.create.mutate(
        v as Parameters<typeof trpcClient.projects.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.projects.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.projects.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.projects.delete.mutate({ id }),
  },

  [ResourceName.routines]: {
    getList: (_params, f) =>
      trpcClient.routines.getMany.query({
        pipelineId: f.string("pipelineId"),
        enabled: f.boolean("enabled"),
      }),
    getOne: (id) => trpcClient.routines.getById.query({ id }),
    create: (v) =>
      trpcClient.routines.create.mutate(
        v as Parameters<typeof trpcClient.routines.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.routines.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.routines.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.routines.delete.mutate({ id }),
  },

  [ResourceName.jobs]: {
    getList: () => trpcClient.jobs.getMany.query(),
    getOne: (id) => trpcClient.jobs.getById.query({ id }),
    create: (v) =>
      trpcClient.jobs.create.mutate(v as Parameters<typeof trpcClient.jobs.create.mutate>[0]),
    // jobs 走 updateStatus + 展开（与迁移前一致）。
    update: (id, v) =>
      trpcClient.jobs.updateStatus.mutate({ id, ...asRecord(v) } as unknown as Parameters<
        typeof trpcClient.jobs.updateStatus.mutate
      >[0]),
  },

  [ResourceName.githubProjects]: {
    getList: () => trpcClient.githubProjects.getMany.query(),
    getOne: (id) => trpcClient.githubProjects.getById.query({ id }),
    create: (v) =>
      trpcClient.githubProjects.create.mutate(
        v as Parameters<typeof trpcClient.githubProjects.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.githubProjects.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.githubProjects.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.githubProjects.delete.mutate({ id }),
  },

  [ResourceName.skills]: {
    getList: () => trpcClient.skills.getMany.query(),
    getOne: (id) => trpcClient.skills.getById.query({ id }),
    create: (v) =>
      trpcClient.skills.create.mutate(v as Parameters<typeof trpcClient.skills.create.mutate>[0]),
    update: (id, v) =>
      trpcClient.skills.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.skills.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.skills.delete.mutate({ id }),
  },

  [ResourceName.skillDraftOperations]: {
    getOne: (id) => trpcClient.skills.draftOperation.query({ id }),
  },

  [ResourceName.skillAnalyses]: {
    getOne: (id) => trpcClient.skills.analyze.query({ id }),
  },

  [ResourceName.distillations]: {
    getList: () => trpcClient.distillations.getMany.query(),
    getOne: (id) => trpcClient.distillations.getById.query({ id }),
    create: (v) =>
      trpcClient.distillations.create.mutate(
        v as Parameters<typeof trpcClient.distillations.create.mutate>[0],
      ),
    update: (id, v) =>
      trpcClient.distillations.update.mutate({ id, patch: asRecord(v) } as Parameters<
        typeof trpcClient.distillations.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.distillations.delete.mutate({ id }),
  },

  [ResourceName.refinements]: {
    getOne: (id) => trpcClient.refinements.getById.query({ id }),
  },

  [ResourceName.settings]: {
    getOne: () => trpcClient.settings.get.query(),
    update: (_id, v) =>
      trpcClient.settings.update.mutate(
        v as Parameters<typeof trpcClient.settings.update.mutate>[0],
      ),
  },

  [ResourceName.operationOutputItemTemplates]: {
    getList: () => trpcClient.operationOutputItemTemplates.getMany.query(),
    getOne: (id) => trpcClient.operationOutputItemTemplates.getById.query({ id }),
    create: (v) =>
      trpcClient.operationOutputItemTemplates.create.mutate(
        v as Parameters<typeof trpcClient.operationOutputItemTemplates.create.mutate>[0],
      ),
    // 模板用展开而非 patch（与迁移前一致）。
    update: (id, v) =>
      trpcClient.operationOutputItemTemplates.update.mutate({ id, ...asRecord(v) } as Parameters<
        typeof trpcClient.operationOutputItemTemplates.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.operationOutputItemTemplates.delete.mutate({ id }),
  },
};
