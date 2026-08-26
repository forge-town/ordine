import { z } from "zod/v4";
import type {
  AgentControlAudience,
  AgentControlRisk,
  AgentControlScope,
  AgentControlToolResult,
} from "@repo/schemas";
import {
  AddNodeInputSchema,
  AgentControlToolOutputSchema,
  ArchiveResourceInputSchema,
  ConnectNodesInputSchema,
  ControlJobInputSchema,
  CreateResourceInputSchema,
  DeleteResourceInputSchema,
  DescribeResourceInputSchema,
  DisconnectEdgeInputSchema,
  FinishCanvasEditInputSchema,
  GetJobTraceInputSchema,
  GetResourceInputSchema,
  InspectCanvasInputSchema,
  ReconnectEdgeInputSchema,
  RemoveNodeInputSchema,
  RunOperationInputSchema,
  RunPipelineInputSchema,
  RunRoutineInputSchema,
  SearchResourcesInputSchema,
  TestConnectorInputSchema,
  UpdateNodeInputSchema,
  UpdateResourceInputSchema,
  ValidateCanvasInputSchema,
} from "./toolSchemas";

export type AgentControlIdempotency =
  | "safe-read"
  | "call-id-required"
  | "approval-bound-single-use";

export type AgentControlToolDefinition<TInput extends z.ZodType = z.ZodType> = {
  name: `ordine.${string}`;
  version: 1;
  title: string;
  description: string;
  inputSchema: TInput;
  outputSchema: typeof AgentControlToolOutputSchema;
  risk: AgentControlRisk;
  audiences: readonly AgentControlAudience[];
  requiredScopes: readonly AgentControlScope[];
  idempotency: AgentControlIdempotency;
  redactedInputPaths: readonly string[];
  executionPreflight?: "pipeline-capability-closure";
};

const ALL_AUDIENCES = [
  "internal-run",
  "public-readwrite",
  "public-readonly",
  "stdio",
] as const satisfies readonly AgentControlAudience[];
const WRITE_AUDIENCES = [
  "internal-run",
  "public-readwrite",
  "stdio",
] as const satisfies readonly AgentControlAudience[];

const defineTool = <TInput extends z.ZodType>(
  definition: Omit<AgentControlToolDefinition<TInput>, "version" | "outputSchema">,
): AgentControlToolDefinition<TInput> => ({
  ...definition,
  version: 1,
  outputSchema: AgentControlToolOutputSchema,
});

export const AGENT_CONTROL_TOOLS = [
  defineTool({
    name: "ordine.search",
    title: "Search ORDINE",
    description: "Search paginated ORDINE resources without loading full resource bodies.",
    inputSchema: SearchResourcesInputSchema,
    risk: "read",
    audiences: ALL_AUDIENCES,
    requiredScopes: ["resources:read"],
    idempotency: "safe-read",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.get_resource",
    title: "Get resource",
    description: "Read one ORDINE resource by its stable type and id.",
    inputSchema: GetResourceInputSchema,
    risk: "read",
    audiences: ALL_AUDIENCES,
    requiredScopes: ["resources:read"],
    idempotency: "safe-read",
    redactedInputPaths: ["data.config", "data.credentials"],
  }),
  defineTool({
    name: "ordine.describe_resource",
    title: "Describe resource",
    description: "Read the writable field contract for one ORDINE resource type on demand.",
    inputSchema: DescribeResourceInputSchema,
    risk: "read",
    audiences: ALL_AUDIENCES,
    requiredScopes: ["resources:read"],
    idempotency: "safe-read",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.create_resource",
    title: "Create resource",
    description: "Create one typed ORDINE resource using a compact validated payload.",
    inputSchema: CreateResourceInputSchema,
    risk: "write",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["resources:write"],
    idempotency: "call-id-required",
    redactedInputPaths: ["data.config.headers", "data.config.env"],
  }),
  defineTool({
    name: "ordine.update_resource",
    title: "Update resource",
    description: "Patch one ORDINE resource; versioned resources may require expectedVersion.",
    inputSchema: UpdateResourceInputSchema,
    risk: "write",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["resources:write"],
    idempotency: "call-id-required",
    redactedInputPaths: ["patch.config.headers", "patch.config.env"],
  }),
  defineTool({
    name: "ordine.archive_resource",
    title: "Archive resource",
    description: "Archive or disable a recoverable ORDINE resource.",
    inputSchema: ArchiveResourceInputSchema,
    risk: "write",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["resources:write"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.delete_resource",
    title: "Delete resource",
    description: "Permanently delete a resource after a matching, unexpired one-time approval.",
    inputSchema: DeleteResourceInputSchema,
    risk: "irreversible",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["irreversible:request"],
    idempotency: "approval-bound-single-use",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.inspect_canvas",
    title: "Inspect Canvas",
    description: "Read a bounded page or selected subset of a Pipeline graph.",
    inputSchema: InspectCanvasInputSchema,
    risk: "read",
    audiences: ALL_AUDIENCES,
    requiredScopes: ["canvas:read"],
    idempotency: "safe-read",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.add_node",
    title: "Add Canvas node",
    description: "Validate and append one node to a rollbackable Canvas Change Set.",
    inputSchema: AddNodeInputSchema,
    risk: "draft",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["canvas:draft"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.update_node",
    title: "Update Canvas node",
    description: "Patch one node in a rollbackable Canvas Change Set.",
    inputSchema: UpdateNodeInputSchema,
    risk: "draft",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["canvas:draft"],
    idempotency: "call-id-required",
    redactedInputPaths: ["patch.config", "patch.credentials"],
  }),
  defineTool({
    name: "ordine.remove_node",
    title: "Remove Canvas node",
    description: "Remove one node from a rollbackable Canvas Change Set.",
    inputSchema: RemoveNodeInputSchema,
    risk: "draft",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["canvas:draft"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.connect_nodes",
    title: "Connect Canvas nodes",
    description: "Validate and add one edge to a rollbackable Canvas Change Set.",
    inputSchema: ConnectNodesInputSchema,
    risk: "draft",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["canvas:draft"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.disconnect_edge",
    title: "Disconnect Canvas edge",
    description: "Remove one edge from a rollbackable Canvas Change Set.",
    inputSchema: DisconnectEdgeInputSchema,
    risk: "draft",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["canvas:draft"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.reconnect_edge",
    title: "Reconnect Canvas edge",
    description: "Validate and reconnect one edge inside a rollbackable Canvas Change Set.",
    inputSchema: ReconnectEdgeInputSchema,
    risk: "draft",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["canvas:draft"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.validate_canvas",
    title: "Validate Canvas",
    description: "Validate the current Change Set graph and return structured repair guidance.",
    inputSchema: ValidateCanvasInputSchema,
    risk: "read",
    audiences: ALL_AUDIENCES,
    requiredScopes: ["canvas:read"],
    idempotency: "safe-read",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.finish_canvas_edit",
    title: "Finish Canvas edit",
    description: "Mark a valid Canvas Change Set ready for user Apply using its base version.",
    inputSchema: FinishCanvasEditInputSchema,
    risk: "draft",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["canvas:draft"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.run_pipeline",
    title: "Run Pipeline",
    description: "Preflight and start a Pipeline job; risky descendants require approval.",
    inputSchema: RunPipelineInputSchema,
    risk: "execute",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["execute"],
    idempotency: "call-id-required",
    redactedInputPaths: ["input"],
    executionPreflight: "pipeline-capability-closure",
  }),
  defineTool({
    name: "ordine.run_operation",
    title: "Run Operation",
    description: "Run one ORDINE Operation after capability preflight.",
    inputSchema: RunOperationInputSchema,
    risk: "execute",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["execute"],
    idempotency: "call-id-required",
    redactedInputPaths: ["input"],
  }),
  defineTool({
    name: "ordine.run_routine",
    title: "Run Routine",
    description: "Run one ORDINE Routine after its Pipeline capability preflight.",
    inputSchema: RunRoutineInputSchema,
    risk: "execute",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["execute"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
    executionPreflight: "pipeline-capability-closure",
  }),
  defineTool({
    name: "ordine.control_job",
    title: "Control Job",
    description: "Pause, resume, or cancel one ORDINE Job.",
    inputSchema: ControlJobInputSchema,
    risk: "execute",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["execute"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.get_job_trace",
    title: "Get Job trace",
    description: "Read a bounded page of trace events for one ORDINE Job.",
    inputSchema: GetJobTraceInputSchema,
    risk: "read",
    audiences: ALL_AUDIENCES,
    requiredScopes: ["resources:read"],
    idempotency: "safe-read",
    redactedInputPaths: [],
  }),
  defineTool({
    name: "ordine.test_connector",
    title: "Test Connector",
    description: "Test an existing Connector without returning its credentials.",
    inputSchema: TestConnectorInputSchema,
    risk: "execute",
    audiences: WRITE_AUDIENCES,
    requiredScopes: ["execute"],
    idempotency: "call-id-required",
    redactedInputPaths: [],
  }),
] as const;

export type AgentControlToolName = (typeof AGENT_CONTROL_TOOLS)[number]["name"];

const toolByName = new Map<string, AgentControlToolDefinition>(
  AGENT_CONTROL_TOOLS.map((tool) => [tool.name, tool]),
);

export const findAgentControlTool = (name: string): AgentControlToolDefinition | undefined =>
  toolByName.get(name);

export const listAgentControlTools = ({
  audience,
  scopes,
}: {
  audience: AgentControlAudience;
  scopes: ReadonlySet<AgentControlScope>;
}): AgentControlToolDefinition[] =>
  AGENT_CONTROL_TOOLS.filter(
    (tool) =>
      tool.audiences.includes(audience) && tool.requiredScopes.every((scope) => scopes.has(scope)),
  );

export const parseAgentControlToolInput = (name: string, input: unknown): unknown => {
  const tool = findAgentControlTool(name);
  if (!tool) throw new Error(`Unknown ORDINE Agent Control tool: ${name}`);

  return tool.inputSchema.parse(input);
};

export const parseAgentControlToolResult = (result: unknown): AgentControlToolResult =>
  AgentControlToolOutputSchema.parse(result);

export const toMcpToolDefinition = (tool: AgentControlToolDefinition) => ({
  name: tool.name,
  title: tool.title,
  description: `${tool.description} [risk: ${tool.risk}]`,
  inputSchema: z.toJSONSchema(tool.inputSchema, { target: "draft-07" }),
  outputSchema: z.toJSONSchema(tool.outputSchema, { target: "draft-07" }),
  annotations: {
    readOnlyHint: tool.risk === "read",
    destructiveHint: tool.risk === "irreversible",
    idempotentHint: tool.idempotency === "safe-read",
    openWorldHint: false,
  },
});
