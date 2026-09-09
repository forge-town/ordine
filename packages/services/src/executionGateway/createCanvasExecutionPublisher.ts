import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  ExecutionOverridesSchema,
  ExecutionPortValuesSchema,
  ExecutionIdentifierSchema,
  ExecutionRequestIdSchema,
  RunRequestInputSchema,
  PipelineDefinitionContentSchema,
  PipelineSchema,
  OperationSchema,
  type PipelineData,
  type Operation,
  type OperationRevision,
  type ExecutionOverrides,
  type ExecutionPortValues,
} from "@repo/schemas";
import {
  compileCanvasExecution,
  getCanvasExecutionOperationIds,
  getCanvasExecutionInputs,
} from "../canvasExecution";
import { type createExecutionGateway, ExecutionGatewayError } from "./createExecutionGateway";
import { contentIdentity, createSubmissionRecovery } from "./submissionRecovery";
import type { PublishExecutionConfiguration } from "./createExecutionConfigurationPublisher";

type Gateway = ReturnType<typeof createExecutionGateway>;
const unwrap = <T>(result: { isErr: () => boolean; error?: Error; value?: T }): T => {
  if (result.isErr()) throw result.error;

  return result.value!;
};
const operationContent = (operation: OperationRevision) =>
  contentIdentity({ ...operation, revision: 0 });
const PublishInputSchema = z.strictObject({
  pipelineId: ExecutionIdentifierSchema,
  expectedRevision: z.number().int().nonnegative().optional(),
  expectedOperationRevisions: z.record(z.string(), z.number().int().nonnegative()).optional(),
  executionOverrides: ExecutionOverridesSchema.optional(),
});
const PrepareInputSchema = PublishInputSchema.extend({
  requestId: ExecutionRequestIdSchema,
  inputs: ExecutionPortValuesSchema.optional(),
});

export const createCanvasExecutionPublisher = (options: {
  gateway: Gateway;
  readPipeline: (id: string) => Promise<unknown>;
  readOperations: () => Promise<unknown>;
  publishConfiguration?: PublishExecutionConfiguration;
}) => {
  const publish = async (rawInput: {
    pipelineId: string;
    expectedRevision?: number;
    expectedOperationRevisions?: Record<string, number>;
    executionOverrides?: ExecutionOverrides;
  }) => {
    const input = PublishInputSchema.parse(rawInput);
    const [rawPipeline, rawOperations, currentResult, headsResult] = await Promise.all([
      options.readPipeline(input.pipelineId),
      options.readOperations(),
      options.gateway.getPipeline(input.pipelineId),
      options.gateway.listOperations(),
    ]);
    const pipeline = { ...PipelineSchema.parse(rawPipeline), ...(rawPipeline as PipelineData) };
    if (pipeline.id !== input.pipelineId) throw new Error("作者流程 ID 与发布目标不匹配。");
    if (!Array.isArray(rawOperations)) throw new Error("Operation 列表无法读取。");
    const referencedIds = new Set(
      pipeline.nodes.flatMap((node) =>
        node.data.nodeType === "operation" ? [node.data.operationId] : [],
      ),
    );
    const referenced = rawOperations.filter(
      (record) => record && typeof record === "object" && referencedIds.has(record.id),
    );
    const operations = referenced.map((operation) => {
      const { sourceSkillId, description, ...fields } = operation as Record<string, unknown>;
      const normalized = {
        ...fields,
        description: description ?? "",
        ...(sourceSkillId == null ? {} : { sourceSkillId }),
      };

      return { ...OperationSchema.parse(normalized), ...(normalized as Operation) };
    });
    const executionOverrides = ExecutionOverridesSchema.parse({
      ...(pipeline.timeoutMs === null ? {} : { activeRunTimeoutMs: pipeline.timeoutMs }),
      ...input.executionOverrides,
    });
    const heads = unwrap<OperationRevision[]>(headsResult);
    if (
      currentResult.isErr() &&
      !(
        currentResult.error instanceof ExecutionGatewayError &&
        currentResult.error.statusCode === 404
      )
    )
      throw currentResult.error;
    const current = currentResult.isOk() ? currentResult.value : undefined;
    const expectedRevision = input.expectedRevision ?? current?.revision ?? 0;
    if (expectedRevision !== (current?.revision ?? 0))
      throw new Error("已发布流程发生变化，请重新载入后再提交。");
    const operationIds = getCanvasExecutionOperationIds(pipeline);
    const bindings = Object.fromEntries(
      operationIds.map((id) => {
        const head = heads.find((operation) => operation.id === id);
        const expected = input.expectedOperationRevisions?.[id] ?? head?.revision ?? 0;
        if (expected !== (head?.revision ?? 0))
          throw new Error(`Operation ${id} 的修订已变化，请重新载入。`);

        return [id, expected + 1];
      }),
    );
    // Authoring timeout is a run preference, not an executable graph property.
    const converted = compileCanvasExecution({
      pipeline: { ...pipeline, timeoutMs: null },
      operations,
      operationRevisions: bindings,
    });
    if (!converted.success)
      throw new Error(
        converted.diagnostics
          .map(
            (item) =>
              `${item.nodeId ?? item.operationId ?? "流程"} · ${item.path.join(".")}: ${item.message}`,
          )
          .join("\n"),
      );
    if (
      options.publishConfiguration &&
      converted.operations.some((operation) => operation.executor.kind === "agent")
    ) {
      const agentIds = new Set(
        converted.operations
          .filter((operation) => operation.executor.kind === "agent")
          .map((operation) => operation.id),
      );
      const configuration = await options.publishConfiguration(
        converted.operations,
        executionOverrides,
        converted.definition.graph.nodes
          .filter((node) => agentIds.has(node.operation.operationId))
          .map((node) => node.executionOverrides),
      );
      if (configuration.isErr()) throw configuration.error;
    }
    const published = new Map<string, OperationRevision>();
    for (const candidate of converted.operations) {
      const head = heads.find((operation) => operation.id === candidate.id);
      if (head && operationContent(head) === operationContent(candidate))
        published.set(head.id, head);
      else {
        const saved = await options.gateway.saveOperation({
          apiVersion: 2,
          expectedRevision: head?.revision ?? 0,
          operation: candidate,
        });
        published.set(candidate.id, unwrap<OperationRevision>(saved));
      }
    }
    const definition = PipelineDefinitionContentSchema.parse({
      ...converted.definition,
      graph: {
        ...converted.definition.graph,
        nodes: converted.definition.graph.nodes.map((node) => ({
          ...node,
          operation: {
            ...node.operation,
            revision: published.get(node.operation.operationId)!.revision,
          },
        })),
      },
    });
    const inputs = getCanvasExecutionInputs(pipeline);
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
      return { pipeline: current, executionOverrides, inputs };
    const saved = await options.gateway.savePipeline({
      apiVersion: 2,
      pipelineId: input.pipelineId,
      expectedRevision,
      definition,
    });
    if (saved.isErr()) throw saved.error;

    return { pipeline: saved.value, executionOverrides, inputs };
  };
  const recover = createSubmissionRecovery({
    lookup: async (requestId) => unwrap(await options.gateway.getRequest(requestId)),
    isNotFound: (error) => error instanceof ExecutionGatewayError && error.statusCode === 404,
    submit: async ({ pipelineId, requestId, expectedRevision, inputs, executionOverrides }) =>
      unwrap(
        await options.gateway.submitPipeline({
          pipelineId,
          requestId,
          expectedRevision,
          inputs,
          executionOverrides,
        }),
      ),
  });

  return {
    publish: (input: Parameters<typeof publish>[0]) =>
      ResultAsync.fromPromise(publish(input), (cause) =>
        cause instanceof Error ? cause : new Error("流程发布失败。"),
      ),
    prepare: (
      input: Parameters<typeof publish>[0] & { requestId: string; inputs?: ExecutionPortValues },
    ) =>
      ResultAsync.fromPromise(
        (async () => {
          const parsed = PrepareInputSchema.parse(input);
          const { requestId, inputs, ...publishInput } = parsed;

          return recover(requestId, parsed, async () => {
            const saved = await publish(publishInput);
            const declaredInputs = saved.pipeline.graph.inputs.map((port) => port.id);
            const unknownInputs = Object.keys(inputs ?? {}).filter(
              (id) => !declaredInputs.includes(id),
            );
            if (unknownInputs.length > 0)
              throw new Error(
                `Unknown Pipeline input ports: ${unknownInputs.join(", ")}. Declared Pipeline inputs: ${declaredInputs.join(", ") || "none"}. Omit inputs to use saved Prompt values; Operation input port ids are not Pipeline input ids.`,
              );

            return RunRequestInputSchema.parse({
              apiVersion: 2,
              pipelineId: saved.pipeline.id,
              requestId,
              expectedRevision: saved.pipeline.revision,
              executionOverrides: saved.executionOverrides,
              inputs: { ...saved.inputs, ...inputs },
            });
          });
        })(),
        (cause) => (cause instanceof Error ? cause : new Error("流程提交失败。")),
      ),
  };
};
