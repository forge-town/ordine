import { vi } from "vitest";
import {
  PipelineSchema,
  OperationSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
  OperationRevisionSchema,
  SaveOperationRevisionSchema,
  SavePipelineDefinitionSchema,
  type OperationRevision,
  type PipelineDefinition,
  type RunRequestReceipt,
} from "@repo/schemas";
import { createExecutionGateway } from "./createExecutionGateway";

export const requestId = "a89f1190-68e5-4372-8a67-0e348c04c0bf";
export const receipt = (id = requestId): RunRequestReceipt => ({
  apiVersion: 2,
  requestId: id,
  state: "accepted",
  preparedRunId: "prepared",
  jobId: "job",
  acceptedAt: "2026-09-08T00:00:00.000Z",
});
export const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
export const failure = (status: number) => json({ error: { message: `HTTP ${status}` } }, status);

export const authoringFixture = () => ({
  pipeline: PipelineSchema.parse({
    id: "pipeline",
    name: "Report",
    description: "",
    sharedContext: "",
    tags: [],
    timeoutMs: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    nodes: [
      {
        id: "render",
        type: "operation",
        position: { x: 0, y: 0 },
        data: {
          nodeType: "operation",
          operationId: "render",
          operationName: "Render",
          label: "Render",
          status: "idle",
        },
      },
      {
        id: "report",
        type: "output-local-path",
        position: { x: 200, y: 0 },
        data: {
          nodeType: "output-local-path",
          label: "Report",
          localPath: "",
          storage: "artifact",
          outputFileName: "report.md",
        },
      },
    ],
    edges: [
      {
        id: "deliver",
        source: "render",
        target: "report",
        data: { handoff: { kind: "handoff", sourcePortId: "result", targetPortId: "input" } },
      },
    ],
  }),
  operations: [
    OperationSchema.parse({
      id: "render",
      name: "Render",
      config: {
        executor: {
          type: "script",
          language: "javascript",
          command: "console.log('# Report')",
          outputMode: "text",
        },
        inputs: [],
        outputs: [
          {
            id: "result",
            name: "Result",
            contentType: "markdown",
            required: true,
            cardinality: "one",
            produces: ["text/markdown"],
          },
        ],
      },
    }),
  ],
});

export const gatewayFixture = () => {
  const operations = new Map<string, OperationRevision>();
  const pipelines = new Map<string, PipelineDefinition>();
  const receipts = new Map<string, RunRequestReceipt>();
  const calls: { method: string; path: string; body: unknown }[] = [];
  const hooks: {
    before?: (call: (typeof calls)[number]) => Response | undefined;
    afterPost?: () => void;
  } = {};
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = {
      method: init?.method ?? "GET",
      path: new URL(String(url)).pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const intercepted = hooks.before?.(call);
    if (intercepted) return intercepted;
    if (call.method === "GET" && call.path.startsWith("/api/v2/run-requests/"))
      return receipts.has(call.path.split("/").at(-1)!)
        ? json(receipts.get(call.path.split("/").at(-1)!))
        : failure(404);
    if (call.method === "GET" && call.path === "/api/v2/operations")
      return json([...operations.values()]);
    if (call.method === "GET" && call.path.startsWith("/api/v2/pipelines/"))
      return pipelines.has(call.path.split("/").at(-1)!)
        ? json(pipelines.get(call.path.split("/").at(-1)!))
        : failure(404);
    if (call.method === "PUT" && call.path.startsWith("/api/v2/operations/")) {
      const body = SaveOperationRevisionSchema.parse(call.body);
      const operation = OperationRevisionSchema.parse(body.operation);
      if (body.expectedRevision !== (operations.get(operation.id)?.revision ?? 0))
        return failure(409);
      operations.set(operation.id, operation);

      return json(operation);
    }
    if (call.method === "PUT" && call.path.startsWith("/api/v2/pipelines/")) {
      const body = SavePipelineDefinitionSchema.parse(call.body);
      if (body.expectedRevision !== (pipelines.get(body.pipelineId)?.revision ?? 0))
        return failure(409);
      const pipeline = PipelineDefinitionSchema.parse({
        apiVersion: 2,
        id: body.pipelineId,
        revision: body.expectedRevision + 1,
        ...body.definition,
      });
      pipelines.set(pipeline.id, pipeline);

      return json(pipeline);
    }
    if (call.method === "POST" && call.path === "/api/v2/run-requests") {
      const body = RunRequestInputSchema.parse(call.body);
      const result = receipt(body.requestId);
      receipts.set(body.requestId, result);
      hooks.afterPost?.();

      return json(result);
    }

    return failure(404);
  }) as unknown as typeof fetch;
  const gateway = createExecutionGateway({
    target: "http://127.0.0.1:19433",
    readToken: async () => "test-agent-token-value-with-at-least-32-characters",
    fetcher,
  });

  return { gateway, operations, pipelines, receipts, calls, hooks };
};
