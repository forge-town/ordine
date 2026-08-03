import { trpcClient } from "@/integrations/trpc/client";
import { ResourceName } from "./resourceNames";
import type { ResourceHandlers } from "./types";

type Variables = Record<string, unknown>;
const asRecord = (variables: unknown): Variables => variables as Variables;

export const resourceHandlers: Partial<Record<string, ResourceHandlers>> = {
  [ResourceName.agents]: {
    getList: () => trpcClient.agents.getMany.query(),
    getOne: (id) => trpcClient.agents.getById.query({ id }),
    create: (variables) =>
      trpcClient.agents.create.mutate(
        variables as Parameters<typeof trpcClient.agents.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.agents.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.agents.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.agents.delete.mutate({ id }),
  },
  [ResourceName.agentRuntimes]: {
    getList: () => trpcClient.agentRuntimes.getMany.query(),
    getOne: (id) => trpcClient.agentRuntimes.getById.query({ id }),
    create: (variables) =>
      trpcClient.agentRuntimes.create.mutate(
        variables as Parameters<typeof trpcClient.agentRuntimes.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.agentRuntimes.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.agentRuntimes.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.agentRuntimes.delete.mutate({ id }),
  },
  [ResourceName.connectors]: {
    getList: () => trpcClient.connectors.getMany.query(),
    getOne: (id) => trpcClient.connectors.getById.query({ id }),
    create: (variables) =>
      trpcClient.connectors.create.mutate(
        variables as Parameters<typeof trpcClient.connectors.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.connectors.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.connectors.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.connectors.delete.mutate({ id }),
  },
  [ResourceName.conversationMessages]: {
    getList: (_params, filters) =>
      trpcClient.conversations.getMany.query({
        pipelineId: filters.string("pipelineId"),
        limit: filters.number("limit"),
      }),
    getOne: (id) => trpcClient.conversations.getById.query({ id }),
    create: (variables) =>
      trpcClient.conversations.create.mutate(
        variables as Parameters<typeof trpcClient.conversations.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.conversations.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.conversations.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.conversations.delete.mutate({ id }),
  },
  [ResourceName.filesystem]: {
    getList: (_params, filters) =>
      trpcClient.filesystem.browse.query({ path: filters.string("path") }),
  },
  [ResourceName.operations]: {
    getList: () => trpcClient.operations.getMany.query(),
    getOne: (id) => trpcClient.operations.getById.query({ id }),
    create: (variables) =>
      trpcClient.operations.create.mutate(
        variables as Parameters<typeof trpcClient.operations.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.operations.update.mutate({ id, ...asRecord(variables) } as Parameters<
        typeof trpcClient.operations.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.operations.delete.mutate({ id }),
  },
  [ResourceName.pipelineAssets]: {
    getList: (_params, filters) =>
      trpcClient.pipelineAssets.getMany.query({ pipelineId: filters.string("pipelineId") }),
    getOne: (id) => trpcClient.pipelineAssets.getById.query({ id }),
    create: (variables) =>
      trpcClient.pipelineAssets.create.mutate(
        variables as Parameters<typeof trpcClient.pipelineAssets.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.pipelineAssets.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.pipelineAssets.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.pipelineAssets.delete.mutate({ id }),
  },
  [ResourceName.pipelines]: {
    getList: () => trpcClient.pipelines.getMany.query(),
    getOne: (id) => trpcClient.pipelines.getById.query({ id }),
    create: (variables) => {
      const { pendingOperations, ...pipelineData } = asRecord(variables);

      return trpcClient.pipelines.create.mutate({
        pipeline: pipelineData,
        pendingOperations: pendingOperations as
          | Parameters<typeof trpcClient.pipelines.create.mutate>[0]["pendingOperations"]
          | undefined,
      } as Parameters<typeof trpcClient.pipelines.create.mutate>[0]);
    },
    update: (id, variables) =>
      trpcClient.pipelines.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.pipelines.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.pipelines.delete.mutate({ id }),
  },
  [ResourceName.projects]: {
    getList: () => trpcClient.projects.getMany.query(),
    getOne: (id) => trpcClient.projects.getById.query({ id }),
    create: (variables) =>
      trpcClient.projects.create.mutate(
        variables as Parameters<typeof trpcClient.projects.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.projects.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.projects.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.projects.delete.mutate({ id }),
  },
  [ResourceName.routines]: {
    getList: (_params, filters) =>
      trpcClient.routines.getMany.query({
        pipelineId: filters.string("pipelineId"),
        enabled: filters.boolean("enabled"),
      }),
    getOne: (id) => trpcClient.routines.getById.query({ id }),
    create: (variables) =>
      trpcClient.routines.create.mutate(
        variables as Parameters<typeof trpcClient.routines.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.routines.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.routines.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.routines.delete.mutate({ id }),
  },
  [ResourceName.jobs]: {
    getList: () => trpcClient.jobs.getMany.query(),
    getOne: (id) => trpcClient.jobs.getById.query({ id }),
    create: (variables) =>
      trpcClient.jobs.create.mutate(
        variables as Parameters<typeof trpcClient.jobs.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.jobs.updateStatus.mutate({ id, ...asRecord(variables) } as unknown as Parameters<
        typeof trpcClient.jobs.updateStatus.mutate
      >[0]),
  },
  [ResourceName.githubProjects]: {
    getList: () => trpcClient.githubProjects.getMany.query(),
    getOne: (id) => trpcClient.githubProjects.getById.query({ id }),
    create: (variables) =>
      trpcClient.githubProjects.create.mutate(
        variables as Parameters<typeof trpcClient.githubProjects.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.githubProjects.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.githubProjects.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.githubProjects.delete.mutate({ id }),
  },
  [ResourceName.skills]: {
    getList: () => trpcClient.skills.getMany.query(),
    getOne: (id) => trpcClient.skills.getById.query({ id }),
    create: (variables) =>
      trpcClient.skills.create.mutate(
        variables as Parameters<typeof trpcClient.skills.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.skills.update.mutate({ id, patch: asRecord(variables) } as Parameters<
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
    create: (variables) =>
      trpcClient.distillations.create.mutate(
        variables as Parameters<typeof trpcClient.distillations.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.distillations.update.mutate({ id, patch: asRecord(variables) } as Parameters<
        typeof trpcClient.distillations.update.mutate
      >[0]),
    deleteOne: (id) => trpcClient.distillations.delete.mutate({ id }),
  },
  [ResourceName.refinements]: {
    getOne: (id) => trpcClient.refinements.getById.query({ id }),
  },
  [ResourceName.settings]: {
    getOne: () => trpcClient.settings.get.query(),
    update: (_id, variables) =>
      trpcClient.settings.update.mutate(
        variables as Parameters<typeof trpcClient.settings.update.mutate>[0],
      ),
  },
  [ResourceName.operationOutputItemTemplates]: {
    getList: () => trpcClient.operationOutputItemTemplates.getMany.query(),
    getOne: (id) => trpcClient.operationOutputItemTemplates.getById.query({ id }),
    create: (variables) =>
      trpcClient.operationOutputItemTemplates.create.mutate(
        variables as Parameters<typeof trpcClient.operationOutputItemTemplates.create.mutate>[0],
      ),
    update: (id, variables) =>
      trpcClient.operationOutputItemTemplates.update.mutate({
        id,
        ...asRecord(variables),
      } as Parameters<typeof trpcClient.operationOutputItemTemplates.update.mutate>[0]),
    deleteOne: (id) => trpcClient.operationOutputItemTemplates.delete.mutate({ id }),
  },
};
