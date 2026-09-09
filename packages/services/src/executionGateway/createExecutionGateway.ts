import { z } from "zod/v4";
import { Result, ResultAsync } from "neverthrow";
import {
  ExecutionEventSchema,
  ExecutionJobControlSchema,
  ExecutionJobSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  SaveOperationRevisionSchema,
  SavePipelineDefinitionSchema,
  type ExecutionOverrides,
  type ExecutionPortValues,
  ExecutionJobResultSchema,
  ExecutionPortValuesSchema,
  ExecutionOverridesSchema,
  ExecutionRequestIdSchema,
  ExecutionIdentifierSchema,
  ExecutionRuntimeConfigRecordSchema,
  ExecutionWorkspaceSettingsRecordSchema,
  SaveExecutionRuntimeConfigSchema,
  SaveExecutionWorkspaceSettingsSchema,
} from "@repo/schemas";
import { createSubmissionRecovery } from "./submissionRecovery";

export class ExecutionGatewayError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ExecutionGatewayError";
  }
}

export const createExecutionGateway = (options: {
  target?: string;
  readToken: () => Promise<string>;
  fetcher?: typeof fetch;
}) => {
  const call = async <T>(
    method: string,
    path: string,
    responseSchema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> => {
    if (!options.target) throw new Error("执行服务尚未连接，不能使用旧执行器替代。");
    const target = new URL(options.target);
    if (
      target.username ||
      target.password ||
      target.search ||
      target.hash ||
      !["http:", "https:"].includes(target.protocol) ||
      (target.protocol === "http:" &&
        !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname))
    )
      throw new Error("执行服务地址无效。");
    const token = (await options.readToken()).trim();
    if (token.length < 32) throw new Error("执行服务的 Agent 凭据未配置。");
    const sent = await ResultAsync.fromPromise(
      (options.fetcher ?? fetch)(new URL(`/api/v2${path}`, target), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Ordine-Api-Version": "2",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      }),
      () => new Error("执行服务响应未知。请查询原 requestId，勿重新创建运行。"),
    );
    if (sent.isErr()) throw sent.error;
    const raw = await sent.value.text();
    const parsedPayload = Result.fromThrowable(
      () => JSON.parse(raw) as unknown,
      () => new Error("执行服务响应不是有效 JSON。"),
    )();
    const payload = parsedPayload.isOk() ? parsedPayload.value : undefined;
    if (!sent.value.ok) {
      const parsed = z.object({ error: z.object({ message: z.string() }) }).safeParse(payload);
      throw new ExecutionGatewayError(
        parsed.success ? parsed.data.error.message : "执行服务拒绝了请求。",
        sent.value.status,
      );
    }
    if (parsedPayload.isErr()) throw parsedPayload.error;

    return responseSchema.parse(payload);
  };
  const result = <T>(action: () => Promise<T>) =>
    ResultAsync.fromPromise(action(), (cause) =>
      cause instanceof Error ? cause : new Error("执行服务请求失败。"),
    );
  const getPipeline = (id: string) =>
    call("GET", `/pipelines/${encodeURIComponent(id)}`, PipelineDefinitionSchema);
  const getRequest = async (requestId: string) => {
    ExecutionRequestIdSchema.parse(requestId);
    const receipt = await call(
      "GET",
      `/run-requests/${encodeURIComponent(requestId)}`,
      RunRequestReceiptSchema,
    );
    if (receipt.requestId !== requestId) throw new Error("执行服务返回了其他 requestId 的回执。");

    return receipt;
  };
  const recover = createSubmissionRecovery({
    lookup: getRequest,
    isNotFound: (error) => error instanceof ExecutionGatewayError && error.statusCode === 404,
    submit: (input) => call("POST", "/run-requests", RunRequestReceiptSchema, input),
  });
  const pipelineInputSchema = z.strictObject({
    requestId: ExecutionRequestIdSchema,
    pipelineId: ExecutionIdentifierSchema,
    expectedRevision: z.number().int().positive().optional(),
    inputs: ExecutionPortValuesSchema.optional(),
    executionOverrides: ExecutionOverridesSchema.optional(),
  });
  const operationInputSchema = z.strictObject({
    requestId: ExecutionRequestIdSchema,
    operationId: ExecutionIdentifierSchema,
    inputs: ExecutionPortValuesSchema.optional(),
  });

  return {
    listRuntimeConfigs: () =>
      result(() => call("GET", "/runtime-configs", z.array(ExecutionRuntimeConfigRecordSchema))),
    saveRuntimeConfig: (input: z.input<typeof SaveExecutionRuntimeConfigSchema>) =>
      result(() => {
        const parsed = SaveExecutionRuntimeConfigSchema.parse(input);

        return call(
          "PUT",
          `/runtime-configs/${encodeURIComponent(parsed.config.id)}`,
          ExecutionRuntimeConfigRecordSchema,
          parsed,
        );
      }),
    getWorkspaceSettings: () =>
      result(() => call("GET", "/workspace-settings", ExecutionWorkspaceSettingsRecordSchema)),
    saveWorkspaceSettings: (input: z.input<typeof SaveExecutionWorkspaceSettingsSchema>) =>
      result(() =>
        call(
          "PUT",
          "/workspace-settings",
          ExecutionWorkspaceSettingsRecordSchema,
          SaveExecutionWorkspaceSettingsSchema.parse(input),
        ),
      ),
    getPipeline: (id: string) => result(() => getPipeline(id)),
    listOperations: () =>
      result(() => call("GET", "/operations", z.array(OperationRevisionSchema))),
    saveOperation: (input: z.input<typeof SaveOperationRevisionSchema>) =>
      result(() =>
        call(
          "PUT",
          `/operations/${encodeURIComponent(input.operation.id)}`,
          OperationRevisionSchema,
          SaveOperationRevisionSchema.parse(input),
        ),
      ),
    savePipeline: (input: z.input<typeof SavePipelineDefinitionSchema>) =>
      result(() =>
        call(
          "PUT",
          `/pipelines/${encodeURIComponent(input.pipelineId)}`,
          PipelineDefinitionSchema,
          SavePipelineDefinitionSchema.parse(input),
        ),
      ),
    getRequest: (requestId: string) => result(() => getRequest(requestId)),
    submitPipeline: (input: {
      requestId: string;
      pipelineId: string;
      expectedRevision?: number;
      inputs?: ExecutionPortValues;
      executionOverrides?: ExecutionOverrides;
    }) =>
      result(async () => {
        const parsed = pipelineInputSchema.parse(input);

        return recover(parsed.requestId, { kind: "pipeline", ...parsed }, async () => {
          const revision =
            parsed.expectedRevision ?? (await getPipeline(parsed.pipelineId)).revision;

          return RunRequestInputSchema.parse({
            apiVersion: 2,
            ...parsed,
            expectedRevision: revision,
          });
        });
      }),
    submitOperation: (input: {
      requestId: string;
      operationId: string;
      inputs?: ExecutionPortValues;
    }) =>
      result(async () => {
        const parsed = operationInputSchema.parse(input);

        return recover(parsed.requestId, { kind: "operation", ...parsed }, async () => {
          const operations = await call("GET", "/operations", z.array(OperationRevisionSchema));
          const operation = operations.find((item) => item.id === parsed.operationId);
          if (!operation) throw new Error("此 Operation 尚未发布为可执行修订。");
          for (const port of operation.inputPorts) {
            if (port.required && !Object.hasOwn(parsed.inputs ?? {}, port.id))
              throw new Error(`请显式提供输入端口 ${port.id}。`);
          }
          const pipelineId = `operation-${parsed.requestId}`;
          const pipeline = await call(
            "PUT",
            `/pipelines/${pipelineId}`,
            PipelineDefinitionSchema,
            SavePipelineDefinitionSchema.parse({
              apiVersion: 2,
              pipelineId,
              expectedRevision: 0,
              definition: {
                name: operation.name,
                graph: {
                  schemaVersion: 2,
                  inputs: operation.inputPorts,
                  nodes: [
                    {
                      id: "operation",
                      operation: { operationId: operation.id, revision: operation.revision },
                    },
                  ],
                  edges: operation.inputPorts.map((port, index) => ({
                    id: `input-${index}`,
                    source: { kind: "input", portId: port.id },
                    target: { nodeId: "operation", portId: port.id },
                    order: 0,
                  })),
                  outputs: operation.outputPorts.map((port) => ({
                    port,
                    source: { nodeId: "operation", portId: port.id },
                  })),
                },
              },
            }),
          );

          return RunRequestInputSchema.parse({
            apiVersion: 2,
            requestId: parsed.requestId,
            pipelineId,
            expectedRevision: pipeline.revision,
            inputs: parsed.inputs,
          });
        });
      }),
    controlJob: (jobId: string, action: "pause" | "resume" | "cancel") =>
      result(() =>
        call(
          "POST",
          `/jobs/${encodeURIComponent(jobId)}/control`,
          ExecutionJobSchema,
          ExecutionJobControlSchema.parse({ action }),
        ),
      ),
    getJob: (jobId: string) =>
      result(() => call("GET", `/jobs/${encodeURIComponent(jobId)}`, ExecutionJobSchema)),
    getJobResult: (jobId: string) =>
      result(() =>
        call("GET", `/jobs/${encodeURIComponent(jobId)}/result`, ExecutionJobResultSchema),
      ),
    getEvents: (jobId: string, afterSequence = 0) =>
      result(() =>
        call(
          "GET",
          `/jobs/${encodeURIComponent(jobId)}/events?afterSequence=${afterSequence}&limit=1000`,
          z.array(ExecutionEventSchema),
        ),
      ),
  };
};
