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
import {
  type Operation,
  type Pipeline,
  type Job,
  type Rule,
  type BestPractice,
  type Skill,
  type Recipe,
  type ChecklistItem,
  type CodeSnippet,
  type Distillation,
  type Refinement,
  type Settings,
  type GithubProject,
} from "@repo/schemas";
import { type DirectoryEntry } from "@repo/services";

export const ResourceName = {
  agentRuntimes: "agentRuntimes",
  filesystem: "filesystem",
  operations: "operations",
  pipelines: "pipelines",
  jobs: "jobs",
  rules: "rules",
  bestPractices: "bestPractices",
  githubProjects: "githubProjects",
  skills: "skills",
  recipes: "recipes",
  checklistItems: "checklistItems",
  codeSnippets: "codeSnippets",
  distillations: "distillations",
  refinements: "refinements",
  settings: "settings",
} as const;

type ResourceTypeMap = {
  filesystem: DirectoryEntry;
  operations: Operation;
  pipelines: Pipeline;
  jobs: Job;
  rules: Rule;
  bestPractices: BestPractice;
  githubProjects: GithubProject;
  skills: Skill;
  recipes: Recipe;
  checklistItems: ChecklistItem;
  codeSnippets: CodeSnippet;
  distillations: Distillation;
  refinements: Refinement;
  settings: Settings;
};

type ResourceKey = keyof ResourceTypeMap;

export const dataProvider: DataProvider = {
  getList: async <K extends ResourceKey>(
    params: GetListParams & { resource: K }
  ): Promise<GetListResponse<ResourceTypeMap[K]>> => {
    const { resource } = params;

    switch (resource) {
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

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.operations: {
        const data = await trpcClient.operations.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.rules: {
        const data = await trpcClient.rules.getMany.query({});

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.bestPractices: {
        const data = await trpcClient.bestPractices.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.checklistItems: {
        const bpFilter = params.filters?.find((f) => "field" in f && f.field === "bestPracticeId");
        const bestPracticeId =
          bpFilter && "value" in bpFilter ? (bpFilter.value as string) : undefined;
        if (!bestPracticeId) {
          return { data: [] as ResourceTypeMap[K][], total: 0 };
        }
        const data = await trpcClient.checklist.getItemsByBestPracticeId.query({ bestPracticeId });

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.codeSnippets: {
        const bpFilter = params.filters?.find((f) => "field" in f && f.field === "bestPracticeId");
        const bestPracticeId =
          bpFilter && "value" in bpFilter ? (bpFilter.value as string) : undefined;
        if (!bestPracticeId) {
          return { data: [] as ResourceTypeMap[K][], total: 0 };
        }
        const data = await trpcClient.codeSnippets.getByBestPracticeId.query({ bestPracticeId });

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.getMany.query();

        return { data: data as ResourceTypeMap[K][], total: data.length };
      }
      default: {
        throw new Error(`getList: unknown resource "${resource}"`);
      }
    }
  },

  getOne: async <K extends ResourceKey>(
    params: GetOneParams & { resource: K }
  ): Promise<GetOneResponse<ResourceTypeMap[K]>> => {
    const { resource, id } = params;

    switch (resource) {
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

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.getById.query({
          id: String(id),
        });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.getById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.rules: {
        const data = await trpcClient.rules.getById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.bestPractices: {
        const data = await trpcClient.bestPractices.getById.query({
          id: String(id),
        });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.getById.query({
          id: String(id),
        });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.getById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.getById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.checklistItems: {
        const data = await trpcClient.checklist.getItemById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.codeSnippets: {
        const data = await trpcClient.codeSnippets.getById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.getById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.refinements: {
        const data = await trpcClient.refinements.getById.query({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.settings: {
        const data = await trpcClient.settings.get.query();

        return { data: data as ResourceTypeMap[K] };
      }
      default: {
        throw new Error(`getOne: unknown resource "${resource}"`);
      }
    }
  },

  create: async <K extends ResourceKey, TVariables = object>(
    params: CreateParams<TVariables> & { resource: K }
  ): Promise<CreateResponse<ResourceTypeMap[K]>> => {
    const { resource, variables } = params;

    switch (resource) {
      case ResourceName.agentRuntimes: {
        const data = await trpcClient.agentRuntimes.create.mutate(
          variables as Parameters<typeof trpcClient.agentRuntimes.create.mutate>[0]
        );

        return { data: data as unknown as TData };
      }
      case ResourceName.operations: {
        const data = await trpcClient.operations.create.mutate(
          variables as Parameters<typeof trpcClient.operations.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.create.mutate(
          variables as Parameters<typeof trpcClient.pipelines.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.create.mutate(
          variables as Parameters<typeof trpcClient.jobs.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.rules: {
        const data = await trpcClient.rules.create.mutate(
          variables as Parameters<typeof trpcClient.rules.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.bestPractices: {
        const data = await trpcClient.bestPractices.create.mutate(
          variables as Parameters<typeof trpcClient.bestPractices.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.create.mutate(
          variables as Parameters<typeof trpcClient.githubProjects.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.create.mutate(
          variables as Parameters<typeof trpcClient.skills.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.create.mutate(
          variables as Parameters<typeof trpcClient.recipes.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.checklistItems: {
        const data = await trpcClient.checklist.createItem.mutate(
          variables as Parameters<typeof trpcClient.checklist.createItem.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.codeSnippets: {
        const data = await trpcClient.codeSnippets.create.mutate(
          variables as Parameters<typeof trpcClient.codeSnippets.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.create.mutate(
          variables as Parameters<typeof trpcClient.distillations.create.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      default: {
        throw new Error(`create: unknown resource "${resource}"`);
      }
    }
  },

  update: async <K extends ResourceKey, TVariables = object>(
    params: UpdateParams<TVariables> & { resource: K }
  ): Promise<UpdateResponse<ResourceTypeMap[K]>> => {
    const { resource, id, variables } = params;

    switch (resource) {
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

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.pipelines.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.jobs: {
        const data = await trpcClient.jobs.updateStatus.mutate({
          id: String(id),
          ...variables,
        } as Parameters<typeof trpcClient.jobs.updateStatus.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.rules: {
        const data = await trpcClient.rules.update.mutate({
          id: String(id),
          ...(variables as Record<string, unknown>),
        } as Parameters<typeof trpcClient.rules.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.bestPractices: {
        const data = await trpcClient.bestPractices.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.bestPractices.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.githubProjects.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.skills.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.recipes.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.checklistItems: {
        const data = await trpcClient.checklist.updateItem.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.checklist.updateItem.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.codeSnippets: {
        const data = await trpcClient.codeSnippets.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.codeSnippets.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.update.mutate({
          id: String(id),
          patch: variables as Record<string, unknown>,
        } as Parameters<typeof trpcClient.distillations.update.mutate>[0]);

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.settings: {
        const data = await trpcClient.settings.update.mutate(
          variables as Parameters<typeof trpcClient.settings.update.mutate>[0]
        );

        return { data: data as ResourceTypeMap[K] };
      }
      default: {
        throw new Error(`update: unknown resource "${resource}"`);
      }
    }
  },

  deleteOne: async <K extends ResourceKey>(
    params: DeleteOneParams & { resource: K }
  ): Promise<DeleteOneResponse<ResourceTypeMap[K]>> => {
    const { resource, id } = params;

    switch (resource) {
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

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.pipelines: {
        const data = await trpcClient.pipelines.delete.mutate({
          id: String(id),
        });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.rules: {
        const data = await trpcClient.rules.delete.mutate({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.bestPractices: {
        const data = await trpcClient.bestPractices.delete.mutate({
          id: String(id),
        });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.githubProjects: {
        const data = await trpcClient.githubProjects.delete.mutate({
          id: String(id),
        });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.skills: {
        const data = await trpcClient.skills.delete.mutate({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.recipes: {
        const data = await trpcClient.recipes.delete.mutate({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.checklistItems: {
        const data = await trpcClient.checklist.deleteItem.mutate({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.codeSnippets: {
        const data = await trpcClient.codeSnippets.delete.mutate({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
      }
      case ResourceName.distillations: {
        const data = await trpcClient.distillations.delete.mutate({ id: String(id) });

        return { data: data as ResourceTypeMap[K] };
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
        payload as Parameters<typeof trpcClient.pipelines.run.mutate>[0]
      );

      return { data: data as TData };
    }
    if (url === "pipelines/optimizeFromDistillation") {
      const data = await trpcClient.pipelines.optimizeFromDistillation.mutate(
        payload as Parameters<
          typeof trpcClient.pipelines.optimizeFromDistillation.mutate
        >[0]
      );

      return { data: data as TData };
    }
    if (url === "rules/toggle") {
      const data = await trpcClient.rules.toggle.mutate(
        payload as Parameters<typeof trpcClient.rules.toggle.mutate>[0]
      );

      return { data: data as TData };
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
        })
      );

      return {
        data: {
          traces,
          agentRuns,
          spansByRun: Object.fromEntries(spansByRunEntries),
        } as TData,
      };
    }
    if (url === "jobs/traces") {
      const { jobId } = payload as { jobId: string };
      const traces = await trpcClient.jobs.getTraces.query({ jobId });

      return { data: { traces } as TData };
    }
    if (url === "jobs/agentRuns") {
      const { jobId } = payload as { jobId: string };
      const agentRuns = await trpcClient.jobs.getAgentRuns.query({ jobId });

      return { data: { agentRuns } as TData };
    }
    if (url === "jobs/agentRunSpans") {
      const { rawExportId } = payload as { rawExportId: number };
      const spans = await trpcClient.jobs.getAgentRunSpans.query({ rawExportId });

      return { data: { spans } as TData };
    }
    if (url === "bestPractices/exportAsZip") {
      const base64 = await trpcClient.bestPractices.exportAsZip.query();

      return { data: { base64 } as TData };
    }
    if (url === "bestPractices/previewImport") {
      const data = await trpcClient.bestPractices.previewImport.mutate(
        payload as Parameters<typeof trpcClient.bestPractices.previewImport.mutate>[0]
      );

      return { data: data as TData };
    }
    if (url === "bestPractices/importBulk") {
      const data = await trpcClient.bestPractices.importBulk.mutate(
        payload as Parameters<typeof trpcClient.bestPractices.importBulk.mutate>[0]
      );

      return { data: data as TData };
    }
    if (url === "refinements/start") {
      const data = await trpcClient.refinements.start.mutate(
        payload as Parameters<typeof trpcClient.refinements.start.mutate>[0]
      );

      return { data: data as TData };
    }
    if (url === "distillations/run") {
      const data = await trpcClient.distillations.run.mutate(
        payload as Parameters<typeof trpcClient.distillations.run.mutate>[0]
      );

      return { data: data as TData };
    }
    if (url === "settings/scanRuntimes") {
      const data = await trpcClient.agentRuntimes.scanRuntimes.query();

      return { data: data as unknown as TData };
    }
    if (url === "agentRuntimes/syncAll") {
      const data = await trpcClient.agentRuntimes.syncAll.mutate(
        payload as unknown as Parameters<typeof trpcClient.agentRuntimes.syncAll.mutate>[0]
      );

      return { data: data as unknown as TData };
    }
    throw new Error(`custom: unknown url "${url}"`);
  },
};
