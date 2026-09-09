import {
  PreparedRunSchema,
  RuntimeGraphSchema,
  OperationRevisionSchema,
  ExecutionArtifactNameSchema,
  ExecutionIdentifierSchema,
  type PreparedRun,
  type OperationRevision,
  type RuntimeNode,
  type RuntimeGraph,
  type RuntimeEdge,
  type ExecutionPortDefinition,
  type ExecutionCondition,
  type ExecutionError,
} from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod/v4";
import { executionError } from "./errors";
import { validatePortDefinition } from "./validatePortValues";

// Derived graph indexes are infrastructure, while every stored domain value comes from schemas.
export type CompiledDefinitionGraph = {
  graph: RuntimeGraph;
  nodes: ReadonlyMap<string, RuntimeNode>;
  operations: ReadonlyMap<string, OperationRevision>;
  incoming: ReadonlyMap<string, RuntimeEdge[]>;
  levels: RuntimeNode[][];
};
export type CompiledGraph = CompiledDefinitionGraph & { prepared: PreparedRun };

const compatible = (source: ExecutionPortDefinition, target: ExecutionPortDefinition) =>
  source.valueType === target.valueType &&
  !(source.cardinality === "many" && target.cardinality === "one");
const conditionCompatible = (port: ExecutionPortDefinition, condition: ExecutionCondition) =>
  condition.operator === "contains"
    ? port.valueType === "text"
    : condition.operator !== "equals" || condition.expected.kind === port.valueType;
const pinKey = (id: string, revision: number) => JSON.stringify([id, revision]);

const validateBuiltin = (operation: OperationRevision): Result<void, ExecutionError> => {
  const executor = operation.executor;
  if (executor.kind !== "builtin") return ok(undefined);
  const input = operation.inputPorts[0];
  const output = operation.outputPorts[0];
  const onePair = operation.inputPorts.length === 1 && operation.outputPorts.length === 1;
  const check = { valid: false };
  switch (executor.name) {
    case "identity": {
      check.valid =
        z.strictObject({}).safeParse(executor.config).success &&
        onePair &&
        !!input &&
        !!output &&
        compatible(input, output);
      break;
    }
    case "merge_text": {
      check.valid =
        z.strictObject({ separator: z.string().optional() }).safeParse(executor.config).success &&
        onePair &&
        input?.valueType === "text" &&
        input.cardinality === "many" &&
        output?.valueType === "text" &&
        output.cardinality === "one";
      break;
    }
    case "write_artifact": {
      check.valid =
        z
          .strictObject({ name: ExecutionArtifactNameSchema, mimeType: z.string().min(1).max(128) })
          .safeParse(executor.config).success &&
        onePair &&
        (input?.valueType === "text" || input?.valueType === "json") &&
        input.cardinality === "one" &&
        output?.valueType === "artifact" &&
        output.cardinality === "one";
      break;
    }
    case "read_artifact": {
      check.valid =
        z.strictObject({}).safeParse(executor.config).success &&
        onePair &&
        input?.valueType === "artifact" &&
        input.cardinality === "one" &&
        output?.valueType === "text" &&
        output.cardinality === "one";
      break;
    }
    case "materialize_file": {
      check.valid =
        z.strictObject({ assetId: ExecutionIdentifierSchema }).safeParse(executor.config).success &&
        operation.inputPorts.length === 0 &&
        operation.outputPorts.length === 1 &&
        output?.valueType === "artifact" &&
        output.cardinality === "one";
      break;
    }
  }

  return check.valid
    ? ok(undefined)
    : err(
        executionError(
          "BUILTIN_CONFIG_UNSUPPORTED",
          "Builtin configuration or port contract is unsupported",
        ),
      );
};

const validateParsedOperation = (operation: OperationRevision): Result<void, ExecutionError> => {
  const builtin = validateBuiltin(operation);
  if (builtin.isErr()) return err(builtin.error);
  for (const port of [...operation.inputPorts, ...operation.outputPorts]) {
    const validation = validatePortDefinition(port);
    if (validation.isErr()) return err(validation.error);
  }

  return ok(undefined);
};

/** Validates an Operation independently of graph bindings, runtime selection and actual inputs. */
export const validateOperationDefinition = (
  operation: OperationRevision,
): Result<void, ExecutionError> => {
  const parsed = OperationRevisionSchema.safeParse(operation);
  if (!parsed.success)
    return err(
      executionError(
        "OPERATION_DEFINITION_INVALID",
        "Operation definition violates the execution contract",
        { field: parsed.error.issues[0]?.path.join(".").slice(0, 200) },
      ),
    );

  return validateParsedOperation(parsed.data);
};

const compileValidatedDefinition = (
  graph: RuntimeGraph,
  pinnedOperations: OperationRevision[],
): Result<CompiledDefinitionGraph, ExecutionError> => {
  const referencedPins = new Set(
    graph.nodes.map((node) => pinKey(node.operation.operationId, node.operation.revision)),
  );
  const operationRevisions = new Map<string, OperationRevision>();
  for (const operation of pinnedOperations) {
    const key = pinKey(operation.id, operation.revision);
    if (operationRevisions.has(key))
      return err(
        executionError("OPERATION_PIN_DUPLICATE", "Duplicate immutable Operation revision"),
      );
    if (!referencedPins.has(key))
      return err(
        executionError(
          "OPERATION_PIN_UNREFERENCED",
          "Unreferenced Operation revision must not be included in the definition",
        ),
      );
    operationRevisions.set(key, operation);
    const validation = validateParsedOperation(operation);
    if (validation.isErr()) return err(validation.error);
  }
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const operations = new Map<string, OperationRevision>();
  const incoming = new Map<string, RuntimeEdge[]>(graph.nodes.map((node) => [node.id, []]));
  for (const node of graph.nodes) {
    const operation = operationRevisions.get(
      pinKey(node.operation.operationId, node.operation.revision),
    );
    if (!operation)
      return err(
        executionError(
          "OPERATION_PIN_MISSING",
          "Definition is missing a pinned Operation revision",
          { nodeId: node.id },
        ),
      );
    operations.set(node.id, operation);
    if (operation.executor.kind === "script" && node.retry.maxAttempts > 1)
      return err(
        executionError(
          "SCRIPT_RETRY_UNSUPPORTED",
          "Script retries require an explicit idempotency capability",
          { nodeId: node.id },
        ),
      );
    if (node.loop) {
      const untilPort = operation.outputPorts.find((port) => port.id === node.loop!.until.portId);
      if (!untilPort || !conditionCompatible(untilPort, node.loop.until.condition))
        return err(
          executionError(
            "LOOP_UNTIL_INVALID",
            "Loop completion condition references an absent or incompatible output",
            { nodeId: node.id },
          ),
        );
      for (const feedback of node.loop.feedback) {
        const source = operation.outputPorts.find((port) => port.id === feedback.sourcePort);
        const target = operation.inputPorts.find((port) => port.id === feedback.targetPort);
        if (!source || !target || !compatible(source, target))
          return err(
            executionError(
              "LOOP_FEEDBACK_INVALID",
              "Loop feedback port types or cardinalities are incompatible",
              { nodeId: node.id },
            ),
          );
      }
    }
  }
  for (const port of [...graph.inputs, ...graph.outputs.map((output) => output.port)]) {
    const validation = validatePortDefinition(port);
    if (validation.isErr()) return err(validation.error);
  }
  for (const edge of graph.edges) {
    const source =
      edge.source.kind === "input"
        ? graph.inputs.find((port) => port.id === edge.source.portId)
        : operations
            .get(edge.source.nodeId)!
            .outputPorts.find((port) => port.id === edge.source.portId);
    const target = operations
      .get(edge.target.nodeId)!
      .inputPorts.find((port) => port.id === edge.target.portId);
    if (!source || !target)
      return err(
        executionError("GRAPH_PORT_UNKNOWN", "Edge references an undeclared port", {
          nodeId: edge.target.nodeId,
          portId: edge.target.portId,
        }),
      );
    if (!compatible(source, target))
      return err(
        executionError(
          "GRAPH_BINDING_INVALID",
          "Edge port types or cardinalities are incompatible",
          { nodeId: edge.target.nodeId, portId: target.id },
        ),
      );
    if (edge.condition && !conditionCompatible(source, edge.condition))
      return err(
        executionError(
          "CONDITION_TYPE_INVALID",
          "Edge condition is incompatible with its source value type",
          { nodeId: edge.target.nodeId },
        ),
      );
    incoming.get(edge.target.nodeId)!.push(edge);
  }
  for (const node of graph.nodes) {
    // ECMAScript stable sort retains declaration order for equal edge order values.
    const edges = incoming.get(node.id)!.sort((left, right) => left.order - right.order);
    for (const port of operations.get(node.id)!.inputPorts) {
      const bindings = edges.filter((edge) => edge.target.portId === port.id);
      if (port.required && bindings.length === 0)
        return err(
          executionError("GRAPH_INPUT_UNBOUND", "A required node input has no graph binding", {
            nodeId: node.id,
            portId: port.id,
          }),
        );
      if (port.cardinality === "one" && bindings.length > 1)
        return err(
          executionError(
            "GRAPH_BINDING_INVALID",
            "A one-valued input cannot have multiple bindings",
            { nodeId: node.id, portId: port.id },
          ),
        );
    }
  }
  for (const output of graph.outputs) {
    const source = operations
      .get(output.source.nodeId)!
      .outputPorts.find((port) => port.id === output.source.portId);
    if (!source || !compatible(source, output.port))
      return err(
        executionError(
          "GRAPH_OUTPUT_INVALID",
          "Graph output references an absent or incompatible source",
          { portId: output.port.id },
        ),
      );
  }
  const levels: RuntimeNode[][] = [];
  const remaining = new Set(nodes.keys());
  const completed = new Set<string>();
  while (remaining.size > 0) {
    const level = graph.nodes.filter(
      (node) =>
        remaining.has(node.id) &&
        incoming
          .get(node.id)!
          .every((edge) => edge.source.kind === "input" || completed.has(edge.source.nodeId)),
    );
    if (level.length === 0)
      return err(executionError("GRAPH_CYCLE", "Runtime graph contains a cycle"));
    levels.push(level);
    for (const node of level) {
      remaining.delete(node.id);
      completed.add(node.id);
    }
  }

  return ok({ graph, nodes, operations, incoming, levels });
};

/** Structure-only compilation for definition storage; no execution snapshot is fabricated. */
export const compileDefinitionGraph = (
  graph: RuntimeGraph,
  operations: OperationRevision[],
): Result<CompiledDefinitionGraph, ExecutionError> => {
  const parsed = z
    .strictObject({
      graph: RuntimeGraphSchema,
      operations: z.array(OperationRevisionSchema).max(200),
    })
    .safeParse({ graph, operations });
  if (!parsed.success)
    return err(
      executionError(
        "DEFINITION_GRAPH_INVALID",
        "Definition graph violates the execution contract",
        { field: parsed.error.issues[0]?.path.join(".").slice(0, 200) },
      ),
    );

  return compileValidatedDefinition(parsed.data.graph, parsed.data.operations);
};

export const compileGraph = (prepared: PreparedRun): Result<CompiledGraph, ExecutionError> => {
  const parsed = PreparedRunSchema.safeParse(prepared);
  if (!parsed.success)
    return err(
      executionError(
        "PREPARED_GRAPH_INVALID",
        "Prepared graph violates the frozen execution contract",
        { field: parsed.error.issues[0]?.path.join(".").slice(0, 200) },
      ),
    );

  return compileValidatedDefinition(parsed.data.pipeline.graph, parsed.data.operations).map(
    (graph) => ({ ...graph, prepared: parsed.data }),
  );
};

export const validatePreparedGraph = (prepared: PreparedRun): Result<void, ExecutionError> =>
  compileGraph(prepared).map(() => undefined);
