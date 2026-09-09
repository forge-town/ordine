import { ResultAsync, type Result } from "neverthrow";
import { z } from "zod/v4";
import {
  ExecutionIdentifierSchema,
  ExecutionRequestIdSchema,
  ExecutionPortValuesSchema,
  PipelineSchema,
  OperationSchema,
  PipelineDefinitionContentSchema,
  RunRequestInputSchema,
  ExecutionOverridesSchema,
  type ExecutionOverrides,
  type ExecutionPortValues,
  type Operation,
} from "@repo/schemas";
import { convertCanvasDraftToExecution } from "../canvasExecution";
import { type createExecutionGateway, ExecutionGatewayError } from "./createExecutionGateway";
import { contentIdentity, createSubmissionRecovery } from "./submissionRecovery";
import type { PublishExecutionConfiguration } from "./createExecutionConfigurationPublisher";

const PublishSchema = z.strictObject({
  operationId: ExecutionIdentifierSchema,
  executionOverrides: ExecutionOverridesSchema.optional(),
});
const PrepareSchema = PublishSchema.extend({
  requestId: ExecutionRequestIdSchema,
  inputs: ExecutionPortValuesSchema.optional(),
});
const unwrap = <T>(result: Result<T, Error>): T => {
  if (result.isErr()) throw result.error;

  return result.value;
};
export const createOperationExecutionPublisher = (options: {
  gateway: ReturnType<typeof createExecutionGateway>;
  readOperations: () => Promise<unknown>;
  publishConfiguration?: PublishExecutionConfiguration;
}) => {
  const publish = async (input: {
    operationId: string;
    executionOverrides?: ExecutionOverrides;
  }) => {
    const { operationId, executionOverrides } = PublishSchema.parse(input);
    const raw = await options.readOperations();
    if (!Array.isArray(raw)) throw new Error("Operation 列表读取失败。");
    const matches = raw.filter((item) => item.id === operationId);
    if (matches.length !== 1) throw new Error("Operation 不存在或标识不唯一。");
    const { sourceSkillId, description, ...fields } = matches[0];
    // SQL stores absent descriptive metadata as null; it has no execution semantics.
    const normalized = {
      ...fields,
      description: description ?? "",
      ...(sourceSkillId == null ? {} : { sourceSkillId }),
    };
    const source: Operation = {
      ...OperationSchema.parse(normalized),
      ...(normalized as Operation),
    };
    const heads = await options.gateway.listOperations();
    if (heads.isErr()) throw heads.error;
    const head = heads.value.find((item) => item.id === operationId);
    const pipelineId = ExecutionIdentifierSchema.parse(`operation-${operationId}`);
    const existing = await options.gateway.getPipeline(pipelineId);
    if (
      existing.isErr() &&
      !(existing.error instanceof ExecutionGatewayError && existing.error.statusCode === 404)
    )
      throw existing.error;
    const current = existing.isOk() ? existing.value : null;
    const ports = source.config.inputs.map((port) => ({
      id: port.id,
      valueType: port.accepts?.[0] === "application/json" ? ("json" as const) : ("text" as const),
      cardinality: port.cardinality ?? "one",
      required: port.required,
      allowEmpty: false,
    }));
    // The normal compiler validates all source declarations; this only binds explicit input IDs.
    if (ports.some((port) => !port.id))
      throw new Error("请先为 Operation 的每个输入设置稳定端口 ID。");
    const converted = convertCanvasDraftToExecution({
      pipeline: PipelineSchema.parse({
        id: pipelineId,
        name: source.name,
        description: source.description,
        sharedContext: "",
        tags: [],
        timeoutMs: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        nodes: [
          {
            id: "operation",
            type: "operation",
            position: { x: 0, y: 0 },
            data: {
              nodeType: "operation",
              label: source.name,
              operationName: source.name,
              operationId,
              status: "idle",
            },
          },
        ],
        edges: [],
      }),
      operations: [source],
      operationRevisions: { [operationId]: (head?.revision ?? 0) + 1 },
      externalInputs: {
        ports: ports.map((port: (typeof ports)[number]) => ({ ...port, id: port.id! })),
        edges: ports.map((port: (typeof ports)[number], index: number) => ({
          id: `input-${index}`,
          source: { kind: "input" as const, portId: port.id! },
          target: { nodeId: "operation", portId: port.id! },
          order: 0,
        })),
      },
    });
    if (!converted.success)
      throw new Error(
        converted.diagnostics
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("\n"),
      );
    const candidate = converted.operations[0]!;
    if (candidate.executor.kind === "agent" && options.publishConfiguration) {
      const configuration = await options.publishConfiguration(
        converted.operations,
        executionOverrides ?? {},
      );
      if (configuration.isErr()) throw configuration.error;
    }
    const saved =
      head &&
      contentIdentity({ ...head, revision: 0 }) === contentIdentity({ ...candidate, revision: 0 })
        ? head
        : await options.gateway.saveOperation({
            apiVersion: 2,
            expectedRevision: head?.revision ?? 0,
            operation: candidate,
          });
    const operation = "isErr" in saved ? unwrap(saved) : saved;
    const definition = PipelineDefinitionContentSchema.parse({
      ...converted.definition,
      graph: {
        ...converted.definition.graph,
        nodes: [
          {
            ...converted.definition.graph.nodes[0],
            operation: { operationId, revision: operation.revision },
          },
        ],
        outputs: operation.outputPorts.map((port) => ({
          port,
          source: { nodeId: "operation", portId: port.id },
        })),
      },
    });
    if (
      current &&
      contentIdentity({
        name: current.name,
        description: current.description,
        sharedContext: current.sharedContext,
        graph: current.graph,
        editor: current.editor,
      }) === contentIdentity(definition)
    )
      return { pipeline: current, operation };
    const published = await options.gateway.savePipeline({
      apiVersion: 2,
      pipelineId,
      expectedRevision: current?.revision ?? 0,
      definition,
    });
    if (published.isErr()) throw published.error;

    return { pipeline: published.value, operation };
  };
  const recover = createSubmissionRecovery({
    lookup: async (id) => unwrap(await options.gateway.getRequest(id)),
    isNotFound: (error) => error instanceof ExecutionGatewayError && error.statusCode === 404,
    submit: async ({ requestId, pipelineId, expectedRevision, inputs, executionOverrides }) =>
      unwrap(
        await options.gateway.submitPipeline({
          requestId,
          pipelineId,
          expectedRevision,
          inputs,
          executionOverrides,
        }),
      ),
  });

  return {
    publish: (input: { operationId: string; executionOverrides?: ExecutionOverrides }) =>
      ResultAsync.fromPromise(publish(input), (cause) =>
        cause instanceof Error ? cause : new Error("Operation 发布失败。"),
      ),
    prepare: (input: {
      operationId: string;
      requestId: string;
      inputs?: ExecutionPortValues;
      executionOverrides?: ExecutionOverrides;
    }) =>
      ResultAsync.fromPromise(
        (async () => {
          const parsed = PrepareSchema.parse(input);

          return recover(parsed.requestId, parsed, async () => {
            const saved = await publish({
              operationId: parsed.operationId,
              executionOverrides: parsed.executionOverrides,
            });

            return RunRequestInputSchema.parse({
              apiVersion: 2,
              requestId: parsed.requestId,
              pipelineId: saved.pipeline.id,
              expectedRevision: saved.pipeline.revision,
              inputs: parsed.inputs,
              executionOverrides: parsed.executionOverrides,
            });
          });
        })(),
        (cause) => (cause instanceof Error ? cause : new Error("Operation 提交失败。")),
      ),
  };
};
