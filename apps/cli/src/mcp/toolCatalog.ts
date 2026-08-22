import { z } from "zod";
import type { McpToolRisk } from "./policy";

type JsonSchema = Record<string, unknown>;
type ApiCallResult = { ok: true; data: unknown } | { ok: false; status: number; message: string };

export type McpApiClient = {
  get: (path: string) => Promise<ApiCallResult>;
  post: (path: string, body?: unknown) => Promise<ApiCallResult>;
  patch: (path: string, body: unknown) => Promise<ApiCallResult>;
  del: (path: string) => Promise<ApiCallResult>;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  risk: McpToolRisk;
  call: (input: unknown, apiClient: McpApiClient) => Promise<unknown>;
};

const emptyInputSchema = { type: "object", properties: {}, additionalProperties: false };
const idInputSchema = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
};
const bodyInputSchema = {
  type: "object",
  properties: { body: { type: "object" } },
  required: ["body"],
  additionalProperties: false,
};
const updateInputSchema = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 }, body: { type: "object" } },
  required: ["id", "body"],
  additionalProperties: false,
};

const IdInputSchema = z.object({ id: z.string().min(1) });
const BodyInputSchema = z.object({ body: z.record(z.string(), z.unknown()) });
const UpdateInputSchema = IdInputSchema.extend({ body: z.record(z.string(), z.unknown()) });

const unwrapApi = <T>(result: ApiCallResult, action: string): T => {
  if (!result.ok) throw new Error(`Failed to ${action}: ${result.status} ${result.message}`);

  return result.data as T;
};

const resources = [
  { plural: "pipelines", singular: "pipeline", path: "/api/pipelines" },
  { plural: "skills", singular: "skill", path: "/api/skills" },
  { plural: "operations", singular: "operation", path: "/api/operations" },
] as const;

const resourceTools = resources.flatMap<McpToolDefinition>((resource) => [
  {
    name: `ordine.list_${resource.plural}`,
    description: `List ORDINE ${resource.plural.replaceAll("_", " ")}. [risk: read]`,
    inputSchema: emptyInputSchema,
    risk: "read",
    call: async (_input, apiClient) =>
      unwrapApi(await apiClient.get(resource.path), `list ${resource.plural}`),
  },
  {
    name: `ordine.get_${resource.singular}`,
    description: `Get one ORDINE ${resource.singular.replaceAll("_", " ")}. [risk: read]`,
    inputSchema: idInputSchema,
    risk: "read",
    call: async (input, apiClient) => {
      const { id } = IdInputSchema.parse(input);

      return unwrapApi(
        await apiClient.get(`${resource.path}/${encodeURIComponent(id)}`),
        `get ${resource.singular}`,
      );
    },
  },
  {
    name: `ordine.create_${resource.singular}`,
    description: `Create an ORDINE ${resource.singular.replaceAll("_", " ")}. [risk: write]`,
    inputSchema: bodyInputSchema,
    risk: "write",
    call: async (input, apiClient) => {
      const { body } = BodyInputSchema.parse(input);

      return unwrapApi(await apiClient.post(resource.path, body), `create ${resource.singular}`);
    },
  },
  {
    name: `ordine.update_${resource.singular}`,
    description: `Update an ORDINE ${resource.singular.replaceAll("_", " ")}. [risk: write]`,
    inputSchema: updateInputSchema,
    risk: "write",
    call: async (input, apiClient) => {
      const { id, body } = UpdateInputSchema.parse(input);

      return unwrapApi(
        await apiClient.patch(`${resource.path}/${encodeURIComponent(id)}`, body),
        `update ${resource.singular}`,
      );
    },
  },
  {
    name: `ordine.delete_${resource.singular}`,
    description: `Delete an ORDINE ${resource.singular.replaceAll("_", " ")}. [risk: irreversible]`,
    inputSchema: idInputSchema,
    risk: "irreversible",
    call: async (input, apiClient) => {
      const { id } = IdInputSchema.parse(input);

      return unwrapApi(
        await apiClient.del(`${resource.path}/${encodeURIComponent(id)}`),
        `delete ${resource.singular}`,
      );
    },
  },
]);

const JobsInputSchema = z.object({ status: z.string().min(1).optional() });
const BrowseInputSchema = z.object({ path: z.string().min(1).optional() });
const RunPipelineInputSchema = z.object({
  pipelineId: z.string().min(1),
  inputPath: z.string().min(1).optional(),
});

export const ORDINE_MCP_TOOLS: readonly McpToolDefinition[] = [
  ...resourceTools,
  {
    name: "ordine.run_pipeline",
    description: "Start an ORDINE pipeline job. [risk: write]",
    inputSchema: {
      type: "object",
      properties: {
        pipelineId: { type: "string", minLength: 1 },
        inputPath: { type: "string", minLength: 1 },
      },
      required: ["pipelineId"],
      additionalProperties: false,
    },
    risk: "write",
    call: async (input, apiClient) => {
      const { pipelineId, inputPath } = RunPipelineInputSchema.parse(input);

      return unwrapApi(
        await apiClient.post(`/api/pipelines/${encodeURIComponent(pipelineId)}/run`, { inputPath }),
        "run pipeline",
      );
    },
  },
  {
    name: "ordine.list_jobs",
    description: "List ORDINE jobs, optionally filtered by status. [risk: read]",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", minLength: 1 } },
      additionalProperties: false,
    },
    risk: "read",
    call: async (input, apiClient) => {
      const { status } = JobsInputSchema.parse(input);
      const query = status ? `?status=${encodeURIComponent(status)}` : "";

      return unwrapApi(await apiClient.get(`/api/jobs${query}`), "list jobs");
    },
  },
  {
    name: "ordine.get_job",
    description: "Get one ORDINE job. [risk: read]",
    inputSchema: idInputSchema,
    risk: "read",
    call: async (input, apiClient) => {
      const { id } = IdInputSchema.parse(input);

      return unwrapApi(await apiClient.get(`/api/jobs/${encodeURIComponent(id)}`), "get job");
    },
  },
  {
    name: "ordine.list_job_traces",
    description: "List trace events for one ORDINE job. [risk: read]",
    inputSchema: idInputSchema,
    risk: "read",
    call: async (input, apiClient) => {
      const { id } = IdInputSchema.parse(input);

      return unwrapApi(
        await apiClient.get(`/api/jobs/${encodeURIComponent(id)}/traces`),
        "list job traces",
      );
    },
  },
  {
    name: "ordine.delete_job",
    description: "Delete one ORDINE job. [risk: irreversible]",
    inputSchema: idInputSchema,
    risk: "irreversible",
    call: async (input, apiClient) => {
      const { id } = IdInputSchema.parse(input);

      return unwrapApi(await apiClient.del(`/api/jobs/${encodeURIComponent(id)}`), "delete job");
    },
  },
  {
    name: "ordine.browse_filesystem",
    description: "List a filesystem directory through the ORDINE API. [risk: read]",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", minLength: 1 } },
      additionalProperties: false,
    },
    risk: "read",
    call: async (input, apiClient) => {
      const { path } = BrowseInputSchema.parse(input);
      const query = path ? `?path=${encodeURIComponent(path)}` : "";

      return unwrapApi(await apiClient.get(`/api/filesystem/browse${query}`), "browse filesystem");
    },
  },
];

export const findMcpTool = (name: string): McpToolDefinition | undefined =>
  ORDINE_MCP_TOOLS.find((tool) => tool.name === name);

export const publicMcpTools = () =>
  ORDINE_MCP_TOOLS.map(({ name, description, inputSchema, risk }) => ({
    name,
    description,
    inputSchema,
    annotations: {
      readOnlyHint: risk === "read",
      destructiveHint: risk === "irreversible",
      idempotentHint: risk === "read",
    },
  }));
