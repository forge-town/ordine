import type {
  BaseRecord,
  CreateParams,
  CreateResponse,
  CustomParams,
  CustomResponse,
  DataProvider,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";
import type {
  AgentRuntimeConfig,
  GithubProject,
  Job,
  JobTrace,
  Operation,
  PipelineData,
  Routine,
} from "@repo/schemas";
import { ResourceName } from "../../constants";

export const canvasStoryAgentRuntimes: AgentRuntimeConfig[] = [
  {
    id: "runtime-codex",
    name: "Codex Local",
    type: "codex",
    connection: { mode: "local" },
  },
];

const canvasStorySettings = [{ id: "default", defaultAgentRuntime: "codex" }];

export const canvasStoryOperations: Operation[] = [
  {
    id: "review-code",
    name: "Review Code",
    description: "Find correctness issues before merging.",
    config: { inputs: [], outputs: [] },
    acceptedObjectTypes: ["file", "folder", "github-project"],
  },
  {
    id: "clean-code",
    name: "Clean Code",
    description: "Rewrite obvious clutter and keep behavior stable.",
    config: { inputs: [], outputs: [] },
    acceptedObjectTypes: ["file", "folder"],
  },
  {
    id: "project-map",
    name: "Project Map",
    description: "Summarize a repository's module structure.",
    config: { inputs: [], outputs: [] },
    acceptedObjectTypes: ["github-project"],
  },
];

export const canvasStoryGithubProjects: GithubProject[] = [
  {
    id: "project-ordine",
    name: "ordine",
    description: "AI-first pipeline orchestration workspace.",
    owner: "woodfish",
    repo: "ordine",
    branch: "main",
    githubUrl: "https://github.com/woodfish/ordine",
    isPrivate: false,
  },
  {
    id: "project-private",
    name: "internal-tools",
    description: "Private automation tools.",
    owner: "woodfish",
    repo: "internal-tools",
    branch: "develop",
    githubUrl: "https://github.com/woodfish/internal-tools-private",
    isPrivate: true,
  },
];

const canvasStoryFilesystem = [
  { name: "apps", type: "directory", path: "/workspace/ordine/apps" },
  { name: "packages", type: "directory", path: "/workspace/ordine/packages" },
  { name: "README.md", type: "file", path: "/workspace/ordine/README.md" },
  { name: "app", type: "directory", path: "/workspace/ordine/apps/app" },
  { name: "server", type: "directory", path: "/workspace/ordine/apps/server" },
  { name: "src", type: "directory", path: "/workspace/ordine/apps/app/src" },
  { name: "package.json", type: "file", path: "/workspace/ordine/apps/app/package.json" },
];

const storyNow = new Date();
const minutesAgo = (minutes: number) => new Date(storyNow.getTime() - minutes * 60_000);

export const canvasStoryJobs: Job[] = [
  {
    id: "job-story",
    title: "Release readiness review",
    type: "pipeline_run",
    status: "running",
    pipelineId: "story-pipeline",
    parentJobId: null,
    error: null,
    startedAt: minutesAgo(14),
    finishedAt: null,
    nodeStatuses: { "review-op": "running" },
    totalTokens: 18_420,
  },
  {
    id: "job-done-story",
    title: "Dependency audit",
    type: "pipeline_run",
    status: "done",
    pipelineId: "dependency-audit",
    parentJobId: null,
    error: null,
    startedAt: minutesAgo(58),
    finishedAt: minutesAgo(51),
    totalTokens: 8_790,
    triggeredBy: "routine",
  },
  {
    id: "job-waiting-story",
    title: "Migration plan",
    type: "pipeline_run",
    status: "running",
    pipelineId: "migration-plan",
    parentJobId: null,
    error: null,
    startedAt: minutesAgo(33),
    finishedAt: null,
    nodeStatuses: { approval: "waitingForUser" },
    totalTokens: 12_340,
  },
  {
    id: "job-paused-story",
    title: "Release readiness review",
    type: "pipeline_run",
    status: "paused",
    pipelineId: "story-pipeline",
    parentJobId: null,
    error: null,
    startedAt: minutesAgo(91),
    finishedAt: null,
    totalTokens: 4_520,
  },
  {
    id: "job-queued-story",
    title: "Dependency audit",
    type: "pipeline_run",
    status: "queued",
    pipelineId: "dependency-audit",
    parentJobId: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    triggeredBy: "routine",
  },
  {
    id: "job-failed-story",
    title: "Migration plan",
    type: "pipeline_run",
    status: "failed",
    pipelineId: "migration-plan",
    parentJobId: null,
    error: "Validation failed at the deployment gate.",
    startedAt: minutesAgo(126),
    finishedAt: minutesAgo(119),
    totalTokens: 6_870,
  },
];

export const canvasStoryRoutines: Routine[] = [
  {
    id: "routine-daily-audit",
    pipelineId: "dependency-audit",
    name: "Daily dependency audit",
    description: "Runs every morning",
    cronExpression: "0 9 * * *",
    inputConfig: null,
    enabled: true,
    lastRunAt: minutesAgo(51),
    nextRunAt: null,
    createdAt: minutesAgo(10_000),
    updatedAt: minutesAgo(51),
  },
  {
    id: "routine-afternoon-review",
    pipelineId: "story-pipeline",
    name: "Afternoon release review",
    description: "Runs on workdays",
    cronExpression: "30 16 * * 1-5",
    inputConfig: null,
    enabled: true,
    lastRunAt: null,
    nextRunAt: null,
    createdAt: minutesAgo(8_000),
    updatedAt: minutesAgo(200),
  },
];

export const canvasStoryJobTraces: JobTrace[] = [
  {
    id: 1,
    jobId: "job-story",
    level: "info",
    message: "[2026-04-08T16:00:00.000Z] Starting Story Pipeline",
    createdAt: new Date("2026-04-08T16:00:00.000Z"),
  },
  {
    id: 2,
    jobId: "job-story",
    level: "info",
    message: "[2026-04-08T16:00:01.000Z] @@NODE_START::review-op",
    createdAt: new Date("2026-04-08T16:00:01.000Z"),
  },
  {
    id: 3,
    jobId: "job-story",
    level: "info",
    message: "[2026-04-08T16:00:02.000Z] Running Review Code",
    createdAt: new Date("2026-04-08T16:00:02.000Z"),
  },
  {
    id: 4,
    jobId: "job-story",
    level: "info",
    message:
      "[2026-04-08T16:00:03.000Z] @@LLM_CONTENT::review-op::### Review\nNo blocking issues in this Storybook scenario.",
    createdAt: new Date("2026-04-08T16:00:03.000Z"),
  },
];

export const canvasStoryPipeline: PipelineData = {
  id: "story-pipeline",
  name: "Story Pipeline",
  description: "Canvas Storybook pipeline fixture.",
  sharedContext: "",
  tags: ["storybook"],
  timeoutMs: null,
  createdAt: new Date("2026-04-08T16:00:00.000Z"),
  updatedAt: new Date("2026-04-08T16:00:00.000Z"),
  nodes: [
    {
      id: "review-op",
      type: "operation",
      position: { x: 80, y: 100 },
      data: {
        label: "Review changes",
        nodeType: "operation",
        operationId: "review-code",
        operationName: "Review Code",
        status: "running",
      },
    },
    {
      id: "validate-op",
      type: "operation",
      position: { x: 360, y: 100 },
      data: {
        label: "Validate checks",
        nodeType: "operation",
        operationId: "project-map",
        operationName: "Project Map",
        status: "idle",
      },
    },
    {
      id: "publish-op",
      type: "operation",
      position: { x: 640, y: 100 },
      data: {
        label: "Publish summary",
        nodeType: "operation",
        operationId: "clean-code",
        operationName: "Clean Code",
        status: "idle",
      },
    },
  ],
  edges: [],
};

const canvasStoryPipelines: PipelineData[] = [
  canvasStoryPipeline,
  {
    ...canvasStoryPipeline,
    id: "dependency-audit",
    name: "Dependency Audit",
    description: "Checks dependency health and upgrade risk.",
  },
  {
    ...canvasStoryPipeline,
    id: "migration-plan",
    name: "Migration Plan",
    description: "Builds and reviews migration plans.",
  },
];

const getFilterValue = (params: GetListParams, field: string): unknown => {
  const filter = params.filters?.find((item) => "field" in item && item.field === field);

  return filter && "value" in filter ? filter.value : undefined;
};

const getCanvasStoryRecords = (resource: string, params?: GetListParams): BaseRecord[] => {
  if (resource === ResourceName.settings) return canvasStorySettings;
  if (resource === ResourceName.agentRuntimes) return canvasStoryAgentRuntimes;
  if (resource === ResourceName.operations) return canvasStoryOperations;
  if (resource === ResourceName.githubProjects) return canvasStoryGithubProjects;
  if (resource === ResourceName.jobs) return canvasStoryJobs;
  if (resource === ResourceName.pipelines) return canvasStoryPipelines;
  if (resource === ResourceName.routines) return canvasStoryRoutines;
  if (resource === ResourceName.filesystem) {
    const path = params ? getFilterValue(params, "path") : undefined;
    if (!path) return canvasStoryFilesystem;

    return canvasStoryFilesystem.filter((entry) => entry.path.startsWith(String(path)));
  }

  return [];
};

const findCanvasStoryRecord = (resource: string, id: string): BaseRecord => {
  const records = getCanvasStoryRecords(resource);
  const record = records.find((item) => String(item.id) === id);

  return record ?? { id };
};

const getCanvasStoryList = <TData extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<TData>> => {
  const data = getCanvasStoryRecords(params.resource, params);

  return Promise.resolve({
    data: data as TData[],
    total: data.length,
  });
};

const getCanvasStoryMany = <TData extends BaseRecord = BaseRecord>(
  params: GetManyParams,
): Promise<GetManyResponse<TData>> => {
  const ids = new Set(params.ids.map(String));
  const data = getCanvasStoryRecords(params.resource).filter((record) =>
    ids.has(String(record.id)),
  );

  return Promise.resolve({ data: data as TData[] });
};

const getCanvasStoryOne = <TData extends BaseRecord = BaseRecord>(
  params: GetOneParams,
): Promise<GetOneResponse<TData>> => {
  const data = findCanvasStoryRecord(params.resource, String(params.id));

  return Promise.resolve({ data: data as TData });
};

const createCanvasStoryRecord = <TData extends BaseRecord = BaseRecord, TVariables = object>(
  params: CreateParams<TVariables>,
): Promise<CreateResponse<TData>> => {
  const variables = params.variables as Record<string, unknown>;
  const id = typeof variables.id === "string" ? variables.id : `${params.resource}-story-created`;

  return Promise.resolve({ data: { id, ...variables } as TData });
};

const updateCanvasStoryRecord = <TData extends BaseRecord = BaseRecord, TVariables = object>(
  params: UpdateParams<TVariables>,
): Promise<UpdateResponse<TData>> => {
  const existing = findCanvasStoryRecord(params.resource, String(params.id));
  const variables = params.variables as Record<string, unknown>;

  return Promise.resolve({ data: { ...existing, ...variables, id: params.id } as TData });
};

const deleteCanvasStoryRecord = <TData extends BaseRecord = BaseRecord, TVariables = object>(
  params: DeleteOneParams<TVariables>,
): Promise<DeleteOneResponse<TData>> => {
  const existing = findCanvasStoryRecord(params.resource, String(params.id));

  return Promise.resolve({ data: existing as TData });
};

const getStoryJobTraces = (jobId: string) => {
  if (!jobId) return canvasStoryJobTraces;

  return canvasStoryJobTraces.filter((trace) => trace.jobId === jobId);
};

const getPayloadJobId = (payload: unknown): string => {
  if (payload && typeof payload === "object" && "jobId" in payload) {
    const jobId = (payload as { jobId?: unknown }).jobId;

    return typeof jobId === "string" ? jobId : "";
  }

  return "";
};

const getCanvasStoryCustom = <
  TData extends BaseRecord = BaseRecord,
  TQuery = unknown,
  TPayload = unknown,
>(
  params: CustomParams<TQuery, TPayload>,
): Promise<CustomResponse<TData>> => {
  if (params.url === "jobs/traces") {
    const jobId = getPayloadJobId(params.payload);
    const traces = getStoryJobTraces(jobId);

    return Promise.resolve({ data: { traces } as unknown as TData });
  }

  if (params.url === "jobs/agentRuns" || params.url === "jobs/agentRunSpans") {
    return Promise.resolve({ data: { items: [] } as unknown as TData });
  }

  if (params.url === "pipelines/run") {
    return Promise.resolve({ data: { jobId: "job-story" } as unknown as TData });
  }

  return Promise.resolve({ data: {} as TData });
};

export const canvasStoryDataProvider: DataProvider = {
  getList: getCanvasStoryList,
  getMany: getCanvasStoryMany,
  getOne: getCanvasStoryOne,
  create: createCanvasStoryRecord,
  update: updateCanvasStoryRecord,
  deleteOne: deleteCanvasStoryRecord,
  getApiUrl: () => "",
  custom: getCanvasStoryCustom,
};
