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
  Connector,
  GithubProject,
  Job,
  JobTrace,
  Operation,
  PipelineAsset,
  PipelineData,
  Project,
  Routine,
  Skill,
} from "@repo/schemas";
import { getCronOccurrenceBuckets } from "@repo/utils/cron";
import { ResourceName } from "../../constants";

export const canvasStoryAgentRuntimes: AgentRuntimeConfig[] = [
  {
    id: "local-codex",
    name: "Codex Local",
    type: "codex",
    connection: { mode: "local" },
  },
  {
    id: "local-claude-code",
    name: "Claude Code",
    type: "claude-code",
    connection: { mode: "local" },
  },
  {
    id: "local-hermes",
    name: "Hermes Local",
    type: "hermes",
    connection: { mode: "local" },
  },
  {
    id: "local-mastra",
    name: "Mastra Worker",
    type: "mastra",
    connection: { mode: "local" },
  },
  {
    id: "runtime-openclaw",
    name: "OpenClaw Build Host",
    type: "openclaw",
    connection: { mode: "ssh", host: "build.local", user: "ordine" },
  },
];

const connectorDate = new Date("2026-08-06T08:00:00.000Z");
const manualCapabilityMetadata = { origin: "manual" as const, sources: [] };
const manualConnectorMetadata = { ...manualCapabilityMetadata, signature: null };
export const canvasStoryConnectors: Connector[] = [
  {
    ...manualConnectorMetadata,
    id: "connector-github",
    name: "GitHub",
    method: "mcp",
    status: "connected",
    scopes: "repos, issues, pull requests",
    config: { transport: "stdio", command: "github-mcp", tools: [{ name: "search_repositories" }] },
    lastSyncAt: connectorDate,
    createdAt: connectorDate,
    updatedAt: connectorDate,
  },
  {
    ...manualConnectorMetadata,
    id: "connector-notion",
    name: "Notion",
    method: "mcp",
    status: "needs_setup",
    scopes: "pages, databases",
    config: { transport: "http", url: "https://mcp.example.com/notion" },
    lastSyncAt: null,
    createdAt: connectorDate,
    updatedAt: connectorDate,
  },
  {
    ...manualConnectorMetadata,
    id: "connector-feishu",
    name: "Feishu",
    method: "direct-api",
    status: "connected",
    scopes: "docs, base, messages",
    config: {},
    lastSyncAt: connectorDate,
    createdAt: connectorDate,
    updatedAt: connectorDate,
  },
  {
    ...manualConnectorMetadata,
    id: "connector-folder",
    name: "Local Folder",
    method: "built-in",
    status: "connected",
    scopes: "read, write",
    config: {},
    lastSyncAt: connectorDate,
    createdAt: connectorDate,
    updatedAt: connectorDate,
  },
  {
    ...manualConnectorMetadata,
    id: "connector-postgres",
    name: "Postgres",
    method: "mcp",
    status: "error",
    scopes: "schema, query",
    config: { transport: "stdio", command: "postgres-mcp", lastError: "Connection refused" },
    lastSyncAt: null,
    createdAt: connectorDate,
    updatedAt: connectorDate,
  },
  {
    ...manualConnectorMetadata,
    id: "connector-slack",
    name: "Slack",
    method: "direct-api",
    status: "needs_setup",
    scopes: "channels, messages",
    config: {},
    lastSyncAt: null,
    createdAt: connectorDate,
    updatedAt: connectorDate,
  },
];

export const canvasStorySkills: Skill[] = [
  {
    ...manualCapabilityMetadata,
    id: "skill-page",
    name: "page-structure",
    label: "Page Structure",
    description:
      "Generate a production page with the repository's established wrapper and content anatomy.",
    category: "page",
    tags: ["react", "page", "built-in"],
  },
  {
    ...manualCapabilityMetadata,
    id: "skill-codex-review",
    name: "codex-review",
    label: "Codex Review",
    description: "Review a change set for correctness risks and missing verification.",
    category: "code-quality",
    tags: ["codex", "review"],
  },
  {
    ...manualCapabilityMetadata,
    id: "skill-claude-refactor",
    name: "claude-code-refactor",
    label: "Refactor Assistant",
    description: "Plan and execute a bounded refactor while preserving behavior.",
    category: "imported",
    tags: ["claude-code", "refactor"],
  },
  {
    ...manualCapabilityMetadata,
    id: "skill-hermes-classify",
    name: "hermes-classify",
    label: "Artifact Classifier",
    description: "Classify generated artifacts for downstream routing.",
    category: "imported",
    tags: ["hermes", "classification"],
  },
  {
    ...manualCapabilityMetadata,
    id: "skill-custom-release",
    name: "release-brief",
    label: "Release Brief",
    description: "Turn run evidence into a concise internal release brief.",
    category: "custom",
    tags: ["custom", "release"],
  },
];

const canvasStorySettings = [
  {
    id: "default",
    defaultAgentRuntime: "codex",
    defaultApiKey: "",
    defaultModel: "gpt-5.2-codex",
    defaultOutputPath: "/workspace/ordine/output",
  },
];

const canvasStoryProjects: Project[] = [
  {
    id: "project-story",
    name: "Ordine Workspace",
    description: "Shared automation pipelines and reusable operations.",
    createdAt: new Date("2026-04-08T16:00:00.000Z"),
    updatedAt: new Date("2026-04-08T16:00:00.000Z"),
  },
];

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

export const canvasStoryPipelineAssets: PipelineAsset[] = [
  {
    id: "asset-release-review",
    pipelineId: "story-pipeline",
    name: "Release Readiness Review",
    description: "Review changes, validate the result, and publish a concise release summary.",
    snapshotNodes: [
      {
        id: "review-op",
        type: "operation",
        position: { x: 80, y: 100 },
        data: {
          label: "Review changes",
          nodeType: "operation",
          operationId: "review-code",
          operationName: "Review Code",
          status: "idle",
        },
      },
    ],
    snapshotEdges: [],
    inputSlots: [],
    totalRuns: 18,
    successRate: 0.94,
    avgDurationMs: 42_000,
    tags: ["review", "release"],
    createdAt: new Date("2026-04-08T16:00:00.000Z"),
    updatedAt: new Date("2026-04-08T16:00:00.000Z"),
  },
  {
    id: "asset-dependency-audit",
    pipelineId: "dependency-audit",
    name: "Dependency Audit",
    description: "Inspect dependency health and summarize upgrade risk.",
    snapshotNodes: [
      {
        id: "map-op",
        type: "operation",
        position: { x: 80, y: 100 },
        data: {
          label: "Map project",
          nodeType: "operation",
          operationId: "project-map",
          operationName: "Project Map",
          status: "idle",
        },
      },
    ],
    snapshotEdges: [],
    inputSlots: [],
    totalRuns: 7,
    successRate: 1,
    avgDurationMs: 25_000,
    tags: ["dependencies"],
    createdAt: new Date("2026-04-08T16:00:00.000Z"),
    updatedAt: new Date("2026-04-08T16:00:00.000Z"),
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
  {
    id: 5,
    jobId: "job-story",
    level: "info",
    message:
      "[2026-04-08T16:00:04.000Z] Wrote output to: /workspace/ordine/output/review-report.md (120 chars)",
    createdAt: new Date("2026-04-08T16:00:04.000Z"),
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
  if (resource === ResourceName.connectors) return canvasStoryConnectors;
  if (resource === ResourceName.projects) return canvasStoryProjects;
  if (resource === ResourceName.operations) return canvasStoryOperations;
  if (resource === ResourceName.pipelineAssets) return canvasStoryPipelineAssets;
  if (resource === ResourceName.githubProjects) return canvasStoryGithubProjects;
  if (resource === ResourceName.jobs) return canvasStoryJobs;
  if (resource === ResourceName.pipelines) return canvasStoryPipelines;
  if (resource === ResourceName.routines) return canvasStoryRoutines;
  if (resource === ResourceName.skills) return canvasStorySkills;
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

  if (params.url === "connectors/connect") {
    const payload = (params.payload ?? {}) as { id?: string };
    const connector = canvasStoryConnectors.find((item) => item.id === payload.id);

    return Promise.resolve({
      data: { ...connector, status: "connected", lastSyncAt: new Date() } as unknown as TData,
    });
  }

  if (params.url === "usage/summary") {
    return Promise.resolve({ data: { totalTokens: 824_600, runCount: 42 } as unknown as TData });
  }

  if (params.url === "usage/dailyTokenSeries") {
    return Promise.resolve({
      data: [
        { date: "08-01", tokens: 74_200 },
        { date: "08-02", tokens: 98_400 },
        { date: "08-03", tokens: 64_800 },
        { date: "08-04", tokens: 132_700 },
        { date: "08-05", tokens: 116_200 },
        { date: "08-06", tokens: 153_900 },
        { date: "08-07", tokens: 184_400 },
      ] as unknown as TData,
    });
  }

  if (params.url === "usage/byPipeline") {
    return Promise.resolve({
      data: [
        { pipelineId: "story-pipeline", totalTokens: 342_000, runCount: 17 },
        { pipelineId: "dependency-audit", totalTokens: 276_400, runCount: 14 },
        { pipelineId: "migration-plan", totalTokens: 206_200, runCount: 11 },
      ] as unknown as TData,
    });
  }

  if (params.url === "usage/byAgent") {
    return Promise.resolve({
      data: [
        {
          agentRuntime: "codex",
          agentId: "codex-reviewer",
          modelId: "gpt-5.6",
          tokens: 318_000,
          runCount: 16,
        },
        {
          agentRuntime: "claude-code",
          agentId: "claude-builder",
          modelId: "sonnet",
          tokens: 284_600,
          runCount: 14,
        },
        {
          agentRuntime: "hermes",
          agentId: "artifact-classifier",
          modelId: null,
          tokens: 222_000,
          runCount: 12,
        },
      ] as unknown as TData,
    });
  }

  if (params.url === "skills/previewImport") {
    return Promise.resolve({ data: { candidates: [], errors: [] } as unknown as TData });
  }

  if (params.url === "settings/scanRuntimes") {
    return Promise.resolve({
      data: [
        { type: "codex", binaryName: "codex", path: "C:/tools/codex.exe" },
        { type: "claude-code", binaryName: "claude", path: "C:/tools/claude.exe" },
        { type: "hermes", binaryName: "hermes", path: "C:/tools/hermes.exe" },
        { type: "mastra", binaryName: "mastra", path: "C:/tools/mastra.exe" },
      ] as unknown as TData,
    });
  }

  if (params.url === "jobs/agentRuns" || params.url === "jobs/agentRunSpans") {
    return Promise.resolve({ data: { items: [] } as unknown as TData });
  }

  if (params.url === "routines/occurrences") {
    const payload = (params.payload ?? {}) as { from?: string; to?: string };
    const from = new Date(payload.from ?? Date.now());
    const to = new Date(payload.to ?? from.getTime() + 7 * 24 * 60 * 60_000);
    const occurrences = canvasStoryRoutines.flatMap((routine) =>
      getCronOccurrenceBuckets(routine.cronExpression, from, to).map((bucket) => ({
        aggregated: bucket.aggregated,
        at: bucket.at.toISOString(),
        routineId: routine.id,
      })),
    );

    return Promise.resolve({
      data: {
        occurrences,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        truncated: false,
      } as unknown as TData,
    });
  }

  if (params.url === "pipelines/run") {
    return Promise.resolve({ data: { jobId: "job-story" } as unknown as TData });
  }

  if (params.url === "pipelineAssets/getUsageCount") {
    return Promise.resolve({ data: { count: 2 } as unknown as TData });
  }

  if (params.url === "pipelines/analyzeIntent") {
    return Promise.resolve({
      data: {
        matchedOperations: [
          {
            operationId: "review-code",
            operationName: "Review Code",
            reason: "Reviews the repository changes and surfaces correctness risks.",
          },
          {
            operationId: "project-map",
            operationName: "Project Map",
            reason: "Builds the project context needed before a detailed review.",
          },
        ],
        unmatchedSteps: [],
      } as unknown as TData,
    });
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
