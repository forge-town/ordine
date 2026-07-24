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
  filesystem: "filesystem",
  operations: "operations",
  pipelines: "pipelines",
  jobs: "jobs",
  githubProjects: "github-projects",
  skills: "skills",
  distillations: "distillations",
  refinements: "refinements",
  settings: "settings",
  operationOutputItemTemplates: "operation-output-item-templates",
};

const getPath = (resource: string) => RESOURCE_PATH[resource] ?? resource;

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const { resource } = params;
    const path = getPath(resource);

    const response = await desktopRequest(`${DESKTOP_API_BASE}/${path}`);
    if (!response.ok) {
      return { data: [] as TData[], total: 0 };
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
    const data = (await response.json()) as TData;

    return { data };
  },

  getApiUrl: () => DESKTOP_API_BASE,

  custom: async <TData extends BaseRecord = BaseRecord>(
    params: CustomParams,
  ): Promise<CustomResponse<TData>> => {
    const { url, method = "get", payload } = params;
    const fetchUrl = url.startsWith("http") ? url : `${DESKTOP_API_BASE}/${url}`;

    const response = await desktopRequest(fetchUrl, {
      method: method.toUpperCase(),
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) {
      throw new Error(
        `Custom request failed: ${method.toUpperCase()} ${fetchUrl} ${response.status}`,
      );
    }
    const data = (await response.json()) as TData;

    return { data };
  },
};
