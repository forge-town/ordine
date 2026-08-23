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
  GetOneParams,
  GetOneResponse,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";
import { DESKTOP_API_BASE, desktopRequest } from "../platform";

const RESOURCE_PATH: Record<string, string> = {
  agents: "agents",
  agentRuntimes: "agents/runtimes",
  connectors: "connectors",
  conversationMessages: "conversations",
  filesystem: "filesystem",
  operations: "operations",
  pipelineAssets: "pipeline-assets",
  pipelines: "pipelines",
  projects: "projects",
  routines: "routines",
  jobs: "jobs",
  githubProjects: "github-projects",
  skills: "skills",
  distillations: "distillations",
  refinements: "refinements",
  settings: "settings",
  operationOutputItemTemplates: "operation-output-item-templates",
};

const getPath = (resource: string) => {
  const path = RESOURCE_PATH[resource];
  if (!path) throw new Error(`Unknown resource "${resource}"`);

  return path;
};

type CustomRequest = {
  url: string;
  method: string;
  body?: unknown;
  transform?: (data: unknown) => unknown;
};

const payloadRecord = (payload: unknown) => (payload ?? {}) as Record<string, unknown>;

const payloadWithout = (payload: unknown, ...fields: string[]) => {
  const body = { ...payloadRecord(payload) };
  for (const field of fields) delete body[field];

  return body;
};

const requiredPayloadString = (payload: unknown, field: string) => {
  const value = payloadRecord(payload)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Custom request requires payload.${field}`);
  }

  return value;
};

const requiredPayloadNumber = (payload: unknown, field: string) => {
  const value = payloadRecord(payload)[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Custom request requires numeric payload.${field}`);
  }

  return value;
};

const usageRequest = (path: string, payload: unknown): CustomRequest => {
  const values = payloadRecord(payload);
  const url = new URL(`${DESKTOP_API_BASE}/usage/${path}`);
  if (values.from !== undefined) url.searchParams.set("from", String(values.from));
  if (values.to !== undefined) url.searchParams.set("to", String(values.to));

  return { url: url.toString(), method: "GET" };
};

const resolveCustomRequest = (url: string, method: string, payload: unknown): CustomRequest => {
  if (url.startsWith("http")) return { url, method, body: payload };

  switch (url) {
    case "pipelines/run": {
      const id = requiredPayloadString(payload, "id");

      return {
        url: `${DESKTOP_API_BASE}/pipelines/${id}/run`,
        method: "POST",
        body: payloadWithout(payload, "id"),
      };
    }
    case "pipelines/analyzeIntent": {
      return {
        url: `${DESKTOP_API_BASE}/pipelines/analyze-intent`,
        method: "POST",
        body: payloadRecord(payload),
      };
    }
    case "pipelines/generateStructure": {
      return {
        url: `${DESKTOP_API_BASE}/pipelines/generate-structure`,
        method: "POST",
        body: payloadRecord(payload),
      };
    }
    case "pipelines/proposeActions": {
      const id = requiredPayloadString(payload, "id");

      return {
        url: `${DESKTOP_API_BASE}/pipelines/${id}/propose-actions`,
        method: "POST",
        body: payloadWithout(payload, "id"),
      };
    }
    case "connectors/connect": {
      return {
        url: `${DESKTOP_API_BASE}/connectors/${requiredPayloadString(payload, "id")}/connect`,
        method: "POST",
      };
    }
    case "conversations/clearAll": {
      return { url: `${DESKTOP_API_BASE}/conversations`, method: "DELETE" };
    }
    case "pipelineAssets/getUsageCount": {
      return {
        url: `${DESKTOP_API_BASE}/pipeline-assets/${requiredPayloadString(payload, "id")}/usage-count`,
        method: "GET",
      };
    }
    case "pipelineAssets/incrementRunStats": {
      return {
        url: `${DESKTOP_API_BASE}/pipeline-assets/${requiredPayloadString(payload, "id")}/increment-run-stats`,
        method: "POST",
        body: payloadRecord(payload).stats,
      };
    }
    case "pipelineAssets/distillFromPipeline": {
      return {
        url: `${DESKTOP_API_BASE}/pipeline-assets/distill/${requiredPayloadString(payload, "pipelineId")}`,
        method: "POST",
      };
    }
    case "routines/runNow": {
      return {
        url: `${DESKTOP_API_BASE}/routines/${requiredPayloadString(payload, "id")}/run-now`,
        method: "POST",
      };
    }
    case "routines/occurrences": {
      const values = payloadRecord(payload);
      const url = new URL(`${DESKTOP_API_BASE}/routines/occurrences`);
      url.searchParams.set("from", requiredPayloadString(values, "from"));
      url.searchParams.set("to", requiredPayloadString(values, "to"));

      return { url: url.toString(), method: "GET" };
    }
    case "usage/summary": {
      return usageRequest("summary", payload);
    }
    case "usage/dailyTokenSeries": {
      return usageRequest("daily-token-series", payload);
    }
    case "usage/byPipeline": {
      return usageRequest("by-pipeline", payload);
    }
    case "usage/byAgent": {
      return usageRequest("by-agent", payload);
    }
    case "jobs/traces": {
      return {
        url: `${DESKTOP_API_BASE}/jobs/${requiredPayloadString(payload, "jobId")}/traces`,
        method: "GET",
        transform: (traces) => ({ traces }),
      };
    }
    case "jobs/agentRuns": {
      return {
        url: `${DESKTOP_API_BASE}/jobs/${requiredPayloadString(payload, "jobId")}/agent-runs`,
        method: "GET",
        transform: (agentRuns) => ({ agentRuns }),
      };
    }
    case "jobs/agentRunSpans": {
      const jobId = requiredPayloadString(payload, "jobId");
      const rawExportId = requiredPayloadNumber(payload, "rawExportId");

      return {
        url: `${DESKTOP_API_BASE}/jobs/${jobId}/agent-runs/${rawExportId}/spans`,
        method: "GET",
        transform: (spans) => ({ spans }),
      };
    }
    case "jobs/pause":
    case "jobs/resume":
    case "jobs/cancel": {
      const action = url.split("/")[1];

      return {
        url: `${DESKTOP_API_BASE}/jobs/${requiredPayloadString(payload, "jobId")}/${action}`,
        method: "POST",
      };
    }
    case "distillations/run": {
      return {
        url: `${DESKTOP_API_BASE}/distillations/${requiredPayloadString(payload, "id")}/run`,
        method: "POST",
      };
    }
    case "operations/run": {
      const operationId = requiredPayloadString(payload, "operationId");

      return {
        url: `${DESKTOP_API_BASE}/operations/${operationId}/run`,
        method: "POST",
        body: payloadWithout(payload, "operationId"),
      };
    }
    case "agentRuntimes/getCatalog": {
      return {
        url: `${DESKTOP_API_BASE}/agent-runtimes/catalog`,
        method: "GET",
      };
    }
    case "agentRuntimes/rescanCatalog": {
      return {
        url: `${DESKTOP_API_BASE}/agent-runtimes/rescan`,
        method: "POST",
      };
    }
    case "pipelines/optimizeFromDistillation":
    case "refinements/start":
    case "settings/scanRuntimes":
    case "agentRuntimes/syncAll":
    case "agentRuntimes/scanAndSync":
    case "skills/previewImport":
    case "skills/importCandidates": {
      throw new Error(`Unsupported Desktop custom endpoint "${url}"`);
    }
    default: {
      throw new Error(`Unknown Desktop custom endpoint "${url}"`);
    }
  }
};

const LIST_FILTERS: Partial<Record<string, string[]>> = {
  conversationMessages: ["pipelineId", "limit"],
  filesystem: ["path"],
  pipelineAssets: ["pipelineId"],
  routines: ["pipelineId", "enabled"],
};

const getListUrl = (params: GetListParams) => {
  const path = params.resource === "filesystem" ? "filesystem/browse" : getPath(params.resource);
  const url = new URL(`${DESKTOP_API_BASE}/${path}`);
  const allowedFields = LIST_FILTERS[params.resource] ?? [];
  for (const filter of params.filters ?? []) {
    if (!("field" in filter) || !("value" in filter) || !allowedFields.includes(filter.field)) {
      continue;
    }
    if (filter.value !== undefined && filter.value !== null) {
      url.searchParams.set(filter.field, String(filter.value));
    }
  }

  return url.toString();
};

const executeCustomRequest = async (request: CustomRequest) => {
  const hasBody = request.body !== undefined;
  const response = await desktopRequest(request.url, {
    method: request.method,
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Custom request failed: ${request.method} ${request.url} ${response.status}`);
  }

  const data = response.status === 204 ? {} : await response.json();

  return request.transform ? request.transform(data) : data;
};

const executeJobAnalysis = async (payload: unknown) => {
  const jobId = requiredPayloadString(payload, "jobId");
  const [tracesResult, agentRunsResult] = await Promise.all([
    executeCustomRequest(resolveCustomRequest("jobs/traces", "GET", { jobId })),
    executeCustomRequest(resolveCustomRequest("jobs/agentRuns", "GET", { jobId })),
  ]);
  const traces = payloadRecord(tracesResult).traces;
  const agentRunsValue = payloadRecord(agentRunsResult).agentRuns;
  const agentRuns = Array.isArray(agentRunsValue) ? agentRunsValue : [];
  const spansByRunEntries = await Promise.all(
    agentRuns.map(async (run) => {
      const rawExportId = requiredPayloadNumber(run, "id");
      const result = await executeCustomRequest(
        resolveCustomRequest("jobs/agentRunSpans", "GET", { jobId, rawExportId }),
      );

      return [rawExportId, payloadRecord(result).spans] as const;
    }),
  );

  return { traces, agentRuns, spansByRun: Object.fromEntries(spansByRunEntries) };
};

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const response = await desktopRequest(getListUrl(params));
    if (!response.ok) {
      throw new Error(`Failed to list ${params.resource}: ${response.status}`);
    }
    const data = (await response.json()) as TData[];

    return { data, total: data.length };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const { resource, id } = params;
    const path = getPath(resource);

    const response = await desktopRequest(`${DESKTOP_API_BASE}/${path}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${resource}/${id}: ${response.status}`);
    }
    const data = (await response.json()) as TData;

    return { data };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const { resource, variables } = params;
    const path = getPath(resource);

    const response = await desktopRequest(`${DESKTOP_API_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(variables),
    });
    if (!response.ok) {
      throw new Error(`Failed to create ${resource}: ${response.status}`);
    }
    const data = (await response.json()) as TData;

    return { data };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const { resource, id, variables } = params;
    const path = getPath(resource);

    const response = await desktopRequest(`${DESKTOP_API_BASE}/${path}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(variables),
    });
    if (!response.ok) {
      throw new Error(`Failed to update ${resource}/${id}: ${response.status}`);
    }
    const data = (await response.json()) as TData;

    return { data };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    const { resource, id } = params;
    const path = getPath(resource);

    const response = await desktopRequest(`${DESKTOP_API_BASE}/${path}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to delete ${resource}/${id}: ${response.status}`);
    }
    const data =
      response.status === 204
        ? ({ id: String(id) } as unknown as TData)
        : ((await response.json()) as TData);

    return { data };
  },

  getApiUrl: () => DESKTOP_API_BASE,

  custom: async <TData extends BaseRecord = BaseRecord>(
    params: CustomParams,
  ): Promise<CustomResponse<TData>> => {
    const { url, method = "get", payload } = params;
    if (url === "jobs/analysis") {
      return { data: (await executeJobAnalysis(payload)) as unknown as TData };
    }

    const request = resolveCustomRequest(url, method.toUpperCase(), payload);
    const data = (await executeCustomRequest(request)) as TData;

    return { data };
  },
};
