import {
  type DataProvider,
  type BaseRecord,
  type GetListParams,
  type GetListResponse,
  type GetOneParams,
  type GetOneResponse,
  type CreateParams,
  type CreateResponse,
  type UpdateParams,
  type UpdateResponse,
  type DeleteOneParams,
  type DeleteOneResponse,
} from "@refinedev/core";
import { trpcClient } from "@/integrations/trpc/client";

export const ResourceName = {
  agents: "agents",
  agentRuntimes: "agentRuntimes",
  filesystem: "filesystem",
  operations: "operations",
  pipelines: "pipelines",
  jobs: "jobs",
  githubProjects: "githubProjects",
  skills: "skills",
  recipes: "recipes",
  distillations: "distillations",
  refinements: "refinements",
  settings: "settings",
  operationOutputItemTemplates: "operationOutputItemTemplates",
} as const;

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const { resource } = params;

    switch (resource) {
      case ResourceName.agents: {
        const data = await trpcClient.agents.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.agentRuntimes: {
        const data = await trpcClient.agentRuntimes.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.filesystem: {
        const pathFilter = params.filters?.find((f) => "field" in f && f.field === "path");
        const path =
          pathFilter && "value" in pathFilter
            ? (pathFilter.value as string | undefined)
            : undefined;
        const data = await trpcClient.filesystem.browse.query({ path });

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.operations: {
        const data = await trpcClient.operations.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.operationOutputItemTemplates: {
        const data = await trpcClient.operationOutputItemTemplates.getMany.query();

        return { data: data as unknown as TData[], total: data.length };
      }
      default: {
        throw new Error(`getList: unknown resource "${resource}"`);
      }
    }
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const { resource, id } = params;

    switch (resource) {
      case ResourceName.agents: {
        const data = await trpcClient.agents.getById.query({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.agentRuntimes: {
        const data = await trpcClient.agentRuntimes.getById.query({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.operations: {
        const data = await trpcClient.operations.getById.query({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.getById.query({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.getById.query({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.getById.query({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.getById.query({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.getById.query({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.getById.query({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.refinements: {
        const data = await trpcClient.refinements.getById.query({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.operationOutputItemTemplates: {
        const data = await trpcClient.operationOutputItemTemplates.getById.query({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.settings: {
        const data = await trpcClient.settings.get.query();

        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`getOne: unknown resource "${resource}"`);
      }
    }
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const { resource, variables } = params;

    switch (resource) {
      case ResourceName.agents: {
        const data = await trpcClient.agents.create.mutate(
          variables as Parameters<typeof trpcClient.agents.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.agentRuntimes: {
        const data = await trpcClient.agentRuntimes.create.mutate(
          variables as Parameters<typeof trpcClient.agentRuntimes.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.operations: {
        const data = await trpcClient.operations.create.mutate(
          variables as Parameters<typeof trpcClient.operations.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.create.mutate(
          variables as Parameters<typeof trpcClient.pipelines.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.create.mutate(
          variables as Parameters<typeof trpcClient.jobs.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.create.mutate(
          variables as Parameters<typeof trpcClient.githubProjects.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.create.mutate(
          variables as Parameters<typeof trpcClient.skills.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.create.mutate(
          variables as Parameters<typeof trpcClient.recipes.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.create.mutate(
          variables as Parameters<typeof trpcClient.distillations.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.operationOutputItemTemplates: {
        const data = await trpcClient.operationOutputItemTemplates.create.mutate(
          variables as Parameters<typeof trpcClient.operationOutputItemTemplates.create.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`create: unknown resource "${resource}"`);
      }
    }
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const { resource, id, variables } = params;

    switch (resource) {
      case ResourceName.agents: {
        const data = await trpcClient.agents.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.agents.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.agentRuntimes: {
        const data = await trpcClient.agentRuntimes.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.agentRuntimes.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.operations: {
        const data = await trpcClient.operations.update.mutate({
          id: String(id),
          ...(variables as Record<string, unknown>),
        } as Parameters<typeof trpcClient.operations.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.pipelines.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.updateStatus.mutate({
          id: String(id),
          ...variables,
        } as unknown as Parameters<typeof trpcClient.jobs.updateStatus.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.githubProjects.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.skills.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.recipes.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.distillations.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.operationOutputItemTemplates: {
        const data = await trpcClient.operationOutputItemTemplates.update.mutate({
          id: String(id),
          ...(variables as Record<string, unknown>),
        } as Parameters<typeof trpcClient.operationOutputItemTemplates.update.mutate>[0]);

        return { data: data as unknown as TData };
      }
      case ResourceName.settings: {
        const data = await trpcClient.settings.update.mutate(
          variables as Parameters<typeof trpcClient.settings.update.mutate>[0],
        );

        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`update: unknown resource "${resource}"`);
      }
    }
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    const { resource, id } = params;

    switch (resource) {
      case ResourceName.agents: {
        const data = await trpcClient.agents.delete.mutate({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.agentRuntimes: {
        const data = await trpcClient.agentRuntimes.delete.mutate({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.operations: {
        const data = await trpcClient.operations.delete.mutate({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.delete.mutate({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.delete.mutate({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.delete.mutate({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.delete.mutate({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.delete.mutate({ id: String(id) });

        return { data: data as unknown as TData };
      }
      case ResourceName.operationOutputItemTemplates: {
        const data = await trpcClient.operationOutputItemTemplates.delete.mutate({
          id: String(id),
        });

        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`deleteOne: unknown resource "${resource}"`);
      }
    }
  },

  getApiUrl: () => "",

  custom: async <
    TData extends BaseRecord = BaseRecord,
    _TQuery = unknown,
    TPayload = unknown,
  >(params: {
    url: string;
    method: string;
    payload?: TPayload;
  }): Promise<{ data: TData }> => {
    const { url, payload } = params;

    if (url === "pipelines/run") {
      const data = await trpcClient.pipelines.run.mutate(
        payload as unknown as Parameters<typeof trpcClient.pipelines.run.mutate>[0],
      );

      return { data: data as unknown as TData };
    }
    if (url === "pipelines/analyzeIntent") {
      const data = await trpcClient.pipelines.analyzeIntent.mutate(
        payload as unknown as Parameters<typeof trpcClient.pipelines.analyzeIntent.mutate>[0],
      );

      return { data: data as unknown as TData };
    }
    if (url === "pipelines/generateStructure") {
      const data = await trpcClient.pipelines.generateStructure.mutate(
        payload as unknown as Parameters<typeof trpcClient.pipelines.generateStructure.mutate>[0],
      );

      return { data: data as unknown as TData };
    }
    if (url === "pipelines/optimizeFromDistillation") {
      const data = await trpcClient.pipelines.optimizeFromDistillation.mutate(
        payload as unknown as Parameters<
          typeof trpcClient.pipelines.optimizeFromDistillation.mutate
        >[0],
      );

      return { data: data as unknown as TData };
    }
    if (url === "jobs/analysis") {
      const { jobId } = payload as { jobId: string };
      const [traces, agentRuns] = await Promise.all([
        trpcClient.jobs.getTraces.query({ jobId }),
        trpcClient.jobs.getAgentRuns.query({ jobId }),
      ]);
      const spansByRunEntries = await Promise.all(
        agentRuns.map(async (run) => {
          const spans = await trpcClient.jobs.getAgentRunSpans.query({ rawExportId: run.id });

          return [run.id, spans] as const;
        }),
      );

      return {
        data: {
          traces,
          agentRuns,
          spansByRun: Object.fromEntries(spansByRunEntries),
        } as unknown as TData,
      };
    }
    if (url === "jobs/traces") {
      const { jobId } = payload as { jobId: string };
      const traces = await trpcClient.jobs.getTraces.query({ jobId });

      return { data: { traces } as unknown as TData };
    }
    if (url === "jobs/agentRuns") {
      const { jobId } = payload as { jobId: string };
      const agentRuns = await trpcClient.jobs.getAgentRuns.query({ jobId });

      return { data: { agentRuns } as unknown as TData };
    }
    if (url === "jobs/agentRunSpans") {
      const { rawExportId } = payload as { rawExportId: number };
      const spans = await trpcClient.jobs.getAgentRunSpans.query({ rawExportId });

      return { data: { spans } as unknown as TData };
    }
    if (url === "refinements/start") {
      const data = await trpcClient.refinements.start.mutate(
        payload as unknown as Parameters<typeof trpcClient.refinements.start.mutate>[0],
      );

      return { data: data as unknown as TData };
    }
    if (url === "distillations/run") {
      const data = await trpcClient.distillations.run.mutate(
        payload as unknown as Parameters<typeof trpcClient.distillations.run.mutate>[0],
      );

      return { data: data as unknown as TData };
    }
    if (url === "settings/scanRuntimes") {
      const data = await trpcClient.agentRuntimes.scanRuntimes.query();

      return { data: data as unknown as TData };
    }
    if (url === "agentRuntimes/syncAll") {
      const data = await trpcClient.agentRuntimes.syncAll.mutate(
        payload as unknown as Parameters<typeof trpcClient.agentRuntimes.syncAll.mutate>[0],
      );

      return { data: data as unknown as TData };
    }
    if (url === "agentRuntimes/scanAndSync") {
      const data = await trpcClient.agentRuntimes.scanAndSync.mutate();

      return { data: data as unknown as TData };
    }
    if (url === "operations/run") {
      const data = await trpcClient.operations.run.mutate(
        payload as unknown as Parameters<typeof trpcClient.operations.run.mutate>[0],
      );

      return { data: data as unknown as TData };
    }
    throw new Error(`custom: unknown url "${url}"`);
  },
};
