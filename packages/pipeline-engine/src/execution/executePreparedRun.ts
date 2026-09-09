import { randomUUID } from "node:crypto";
import type {
  ExecutionError,
  ExecutionNodeState,
  ExecutionPortValues,
  OperationRevision,
  PreparedRun,
  ResolvedNodeExecution,
  RuntimeNode,
} from "@repo/schemas";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import { compileGraph, type CompiledGraph } from "./compileGraph";
import { evaluateExecutionCondition } from "./conditions";
import { executionError } from "./errors";
import {
  lookupArtifact,
  validatePortValues,
  type ArtifactMetadataLookup,
} from "./validatePortValues";

export type OperationAttemptContext = {
  jobId: string;
  node: RuntimeNode;
  operation: OperationRevision;
  resolved: ResolvedNodeExecution;
  inputs: ExecutionPortValues;
  attemptId: string;
  iteration: number;
  attemptNumber: number;
  signal: AbortSignal;
};
export type CheckpointContext = Omit<
  OperationAttemptContext,
  "attemptId" | "iteration" | "attemptNumber"
>;
export type ExecutePreparedRunOptions = {
  prepared: PreparedRun;
  jobId: string;
  signal: AbortSignal;
  maxConcurrency?: number;
  attemptIdFactory?: () => string;
  executeOperation: (
    context: OperationAttemptContext,
  ) => Promise<Result<ExecutionPortValues, ExecutionError>>;
  getArtifact: ArtifactMetadataLookup;
  onAttemptStart: (context: OperationAttemptContext) => Promise<Result<void, ExecutionError>>;
  onAttemptEnd: (
    context: OperationAttemptContext,
    result: Result<ExecutionPortValues, ExecutionError>,
  ) => Promise<Result<void, ExecutionError>>;
  waitForCheckpoint?: (context: CheckpointContext) => Promise<Result<void, ExecutionError>>;
  onNodeState?: (
    node: RuntimeNode,
    state: ExecutionNodeState,
  ) => Promise<Result<void, ExecutionError>>;
};
export type PreparedRunExecutionResult = { outputs: ExecutionPortValues; warnings: string[] };

const call = <T>(
  fn: () => Promise<Result<T, ExecutionError>>,
  code: string,
  message: string,
): ResultAsync<T, ExecutionError> =>
  ResultAsync.fromPromise(Promise.resolve().then(fn), () =>
    executionError(code, message, { stage: "execution" }),
  ).andThen((result) => result);
const callback = (fn: () => Promise<Result<void, ExecutionError>>, field: string) =>
  call(fn, "CALLBACK_FAILED", "Execution lifecycle callback threw").mapErr((error) =>
    executionError(
      "CALLBACK_FAILED",
      `Execution lifecycle callback failed: ${error.message}`.slice(0, 2000),
      { stage: "execution", field },
    ),
  );
const cancelled = (options: ExecutePreparedRunOptions): ExecutionError =>
  executionError(
    options.signal.aborted ? "CANCELLED" : "SIBLING_ABORTED",
    options.signal.aborted
      ? "Execution was cancelled by its parent"
      : "Execution stopped after another required node failed",
    { stage: "execution", jobId: options.jobId },
  );
const canRetry = (error: ExecutionError, node: RuntimeNode, attemptNumber: number) =>
  error.retryable &&
  node.retry.retryableCodes.includes(error.code) &&
  attemptNumber < node.retry.maxAttempts &&
  !["authentication", "validation", "approval", "preparation"].includes(error.stage) &&
  !/(?:CANCEL|ABORT|AUTH|VALIDATION|CALLBACK)/iu.test(error.code);

const executeCompiled = async (
  options: ExecutePreparedRunOptions,
  graph: CompiledGraph,
  controller: AbortController,
): Promise<Result<PreparedRunExecutionResult, ExecutionError>> => {
  const signal = controller.signal;
  const outputsByNode = new Map<string, ExecutionPortValues>();
  const warnings: string[] = [];
  const attemptIds = new Set<string>();
  const scheduler: { hardFailure?: ExecutionError } = {};
  const state = (node: RuntimeNode, value: ExecutionNodeState) =>
    options.onNodeState === undefined
      ? Promise.resolve(ok<void, ExecutionError>(undefined))
      : callback(() => options.onNodeState!(node, value), "onNodeState");
  const failHard = (error: ExecutionError) => {
    if (scheduler.hardFailure === undefined || error.code === "CALLBACK_FAILED") {
      scheduler.hardFailure = error;
      controller.abort(error);
    }
  };

  const runNode = async (
    node: RuntimeNode,
  ): Promise<Result<ExecutionPortValues | undefined, ExecutionError>> => {
    const operation = graph.operations.get(node.id)!;
    const inputs: ExecutionPortValues = {};
    const edges = graph.incoming.get(node.id)!;
    const bindings = { activeEdges: 0 };
    for (const edge of edges) {
      const sourceValues =
        edge.source.kind === "input"
          ? graph.prepared.inputs[edge.source.portId]
          : outputsByNode.get(edge.source.nodeId)?.[edge.source.portId];
      if (edge.condition) {
        const condition = await evaluateExecutionCondition(
          edge.condition,
          sourceValues ?? [],
          options.getArtifact,
        );
        if (condition.isErr()) return err(condition.error);
        if (!condition.value) continue;
      }
      bindings.activeEdges++;
      if (sourceValues !== undefined)
        inputs[edge.target.portId] = [...(inputs[edge.target.portId] ?? []), ...sourceValues];
    }
    if (signal.aborted) return err(cancelled(options));
    if (edges.length > 0 && bindings.activeEdges === 0) {
      const skipped = await state(node, "skipped");

      return skipped.isErr() ? err(skipped.error) : ok(undefined);
    }
    const context: CheckpointContext = {
      jobId: options.jobId,
      node,
      operation,
      resolved: graph.prepared.resolvedNodes[node.id]!,
      inputs,
      signal,
    };
    if (node.checkpoint) {
      if (!options.waitForCheckpoint)
        return err(
          executionError(
            "CHECKPOINT_HANDLER_REQUIRED",
            "Checkpoint nodes require an acknowledgement handler",
            { nodeId: node.id },
          ),
        );
      const waiting = await state(node, "waiting_for_input");
      if (waiting.isErr()) return err(waiting.error);
      const acknowledged = await callback(
        () => options.waitForCheckpoint!(context),
        "waitForCheckpoint",
      );
      if (signal.aborted) return err(cancelled(options));
      if (acknowledged.isErr()) return err(acknowledged.error);
    }
    const started = await state(node, "running");
    if (started.isErr()) return err(started.error);
    const loopState: { inputs: ExecutionPortValues; outputs?: ExecutionPortValues } = { inputs };
    for (const iteration of Array.from(
      { length: node.loop?.maxIterations ?? 1 },
      (_, index) => index + 1,
    )) {
      delete loopState.outputs;
      for (const attemptNumber of Array.from(
        { length: node.retry.maxAttempts },
        (_, index) => index + 1,
      )) {
        if (signal.aborted) return err(cancelled(options));
        const idResult = Result.fromThrowable(
          () => (options.attemptIdFactory ?? randomUUID)(),
          () =>
            executionError("ATTEMPT_ID_INVALID", "Attempt identifier factory failed", {
              stage: "execution",
            }),
        )();
        if (idResult.isErr()) return err(idResult.error);
        if (!z.uuid().safeParse(idResult.value).success || attemptIds.has(idResult.value))
          return err(
            executionError("ATTEMPT_ID_INVALID", "Attempt identifiers must be unique UUIDs", {
              stage: "execution",
            }),
          );
        attemptIds.add(idResult.value);
        const attempt: OperationAttemptContext = {
          ...context,
          inputs: loopState.inputs,
          attemptId: idResult.value,
          iteration,
          attemptNumber,
        };
        const recorded = await callback(() => options.onAttemptStart(attempt), "onAttemptStart");
        if (recorded.isErr()) return err(recorded.error);
        const outcome: { result: Result<ExecutionPortValues, ExecutionError> } = {
          result: signal.aborted
            ? err(cancelled(options))
            : await validatePortValues(operation.inputPorts, loopState.inputs, options.getArtifact),
        };
        if (outcome.result.isOk() && !signal.aborted)
          outcome.result = await call(
            () => options.executeOperation(attempt),
            "EXECUTOR_FAILED",
            "Operation executor threw unexpectedly",
          );
        if (signal.aborted) outcome.result = err(cancelled(options));
        if (outcome.result.isOk())
          outcome.result = await validatePortValues(
            operation.outputPorts,
            outcome.result.value,
            options.getArtifact,
          );
        if (signal.aborted) outcome.result = err(cancelled(options));
        // Stop sibling dispatch immediately, before waiting for a failed attempt's persistence.
        if (
          outcome.result.isErr() &&
          !signal.aborted &&
          node.failurePolicy === "required" &&
          !canRetry(outcome.result.error, node, attemptNumber)
        )
          failHard({ ...outcome.result.error, jobId: options.jobId, nodeId: node.id });
        const ended = await callback(
          () => options.onAttemptEnd(attempt, outcome.result),
          "onAttemptEnd",
        );
        if (ended.isErr()) return err(ended.error);
        if (outcome.result.isErr()) {
          if (signal.aborted || !canRetry(outcome.result.error, node, attemptNumber))
            return err(outcome.result.error);
          continue;
        }
        loopState.outputs = outcome.result.value;
        break;
      }
      if (loopState.outputs === undefined)
        return err(
          executionError("ATTEMPTS_EXHAUSTED", "Operation produced no successful attempt", {
            stage: "execution",
            nodeId: node.id,
          }),
        );
      if (!node.loop) return ok(loopState.outputs);
      const complete = await evaluateExecutionCondition(
        node.loop.until.condition,
        loopState.outputs[node.loop.until.portId] ?? [],
        options.getArtifact,
      );
      if (complete.isErr()) return err(complete.error);
      if (complete.value) return ok(loopState.outputs);
      if (iteration === node.loop.maxIterations)
        return err(
          executionError(
            "LOOP_LIMIT_REACHED",
            "Loop completion condition was not satisfied within its iteration limit",
            { stage: "execution", nodeId: node.id },
          ),
        );
      loopState.inputs = { ...loopState.inputs };
      for (const binding of node.loop.feedback) {
        const values = loopState.outputs[binding.sourcePort];
        if (values === undefined) delete loopState.inputs[binding.targetPort];
        else loopState.inputs[binding.targetPort] = [...values];
      }
    }

    return err(
      executionError("LOOP_LIMIT_REACHED", "Loop did not produce a completed result", {
        stage: "execution",
        nodeId: node.id,
      }),
    );
  };

  for (const snapshot of graph.prepared.inputArtifacts) {
    if (signal.aborted) return err(cancelled(options));
    const current = await options.getArtifact(snapshot.artifactId);
    if (current.isErr()) return err(current.error);
  }
  const inputsValid = await validatePortValues(
    graph.prepared.pipeline.graph.inputs,
    graph.prepared.inputs,
    options.getArtifact,
  );
  if (inputsValid.isErr()) return err(inputsValid.error);
  for (const level of graph.levels) {
    const queue = { next: 0 };
    const worker = async () => {
      while (!signal.aborted && scheduler.hardFailure === undefined && queue.next < level.length) {
        const node = level[queue.next++]!;
        const result = await ResultAsync.fromPromise(runNode(node), () =>
          executionError("ENGINE_FAILED", "Node execution failed unexpectedly", {
            stage: "execution",
          }),
        ).andThen((value) => value);
        if (result.isErr()) {
          const failure = { ...result.error, jobId: options.jobId, nodeId: node.id };
          const aborted = signal.aborted;
          const isHard =
            node.failurePolicy === "required" ||
            failure.code === "CALLBACK_FAILED" ||
            failure.code === "ATTEMPT_ID_INVALID" ||
            aborted;
          if (isHard && (!aborted || failure.code === "CALLBACK_FAILED")) failHard(failure);
          const recorded = await state(
            node,
            failure.code === "CANCELLED" || failure.code === "SIBLING_ABORTED"
              ? "cancelled"
              : "failed",
          );
          if (recorded.isErr()) failHard(recorded.error);
          if (!isHard)
            warnings.push(`Node ${node.id} failed (${failure.code}): ${failure.message}`);
        } else if (result.value !== undefined && !signal.aborted) {
          const recorded = await state(node, "succeeded");
          if (recorded.isErr()) failHard(recorded.error);
          else outputsByNode.set(node.id, result.value);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(options.maxConcurrency ?? 2, level.length) }, () => worker()),
    );
    if (scheduler.hardFailure !== undefined) return err(scheduler.hardFailure);
    if (signal.aborted) return err(cancelled(options));
  }
  const outputs: ExecutionPortValues = {};
  for (const output of graph.prepared.pipeline.graph.outputs) {
    const values = outputsByNode.get(output.source.nodeId)?.[output.source.portId];
    if (values !== undefined) outputs[output.port.id] = [...values];
  }
  const valid = await validatePortValues(
    graph.prepared.pipeline.graph.outputs.map((output) => output.port),
    outputs,
    options.getArtifact,
  );
  if (valid.isErr()) return err(valid.error);
  if (signal.aborted) return err(cancelled(options));

  return ok({ outputs, warnings });
};

export const executePreparedRun = async (
  options: ExecutePreparedRunOptions,
): Promise<Result<PreparedRunExecutionResult, ExecutionError>> => {
  if (options.signal.aborted) return err(cancelled(options));
  if (
    !Number.isInteger(options.maxConcurrency ?? 2) ||
    (options.maxConcurrency ?? 2) < 1 ||
    (options.maxConcurrency ?? 2) > 32
  )
    return err(
      executionError("CONCURRENCY_INVALID", "Concurrency must be an integer between 1 and 32"),
    );
  const graph = compileGraph(options.prepared);
  if (graph.isErr()) return err(graph.error);
  if (
    !options.waitForCheckpoint &&
    graph.value.prepared.pipeline.graph.nodes.some((node) => node.checkpoint)
  )
    return err(
      executionError(
        "CHECKPOINT_HANDLER_REQUIRED",
        "Checkpoint nodes require an acknowledgement handler",
      ),
    );
  const controller = new AbortController();
  const frozenInputs = new Map(
    graph.value.prepared.inputArtifacts.map((snapshot) => [snapshot.artifactId, snapshot]),
  );
  const executionOptions: ExecutePreparedRunOptions = {
    ...options,
    getArtifact: async (id) =>
      lookupArtifact(id, options.getArtifact).andThen((metadata) => {
        const snapshot = frozenInputs.get(id);
        if (
          snapshot &&
          (metadata.mimeType !== snapshot.mimeType ||
            metadata.sizeBytes !== snapshot.sizeBytes ||
            metadata.sha256 !== snapshot.sha256)
        )
          return err(
            executionError(
              "INPUT_ARTIFACT_CHANGED",
              "Input artifact metadata differs from its prepared fingerprint",
              { stage: "artifact" },
            ),
          );

        return ok(metadata);
      }),
  };
  const abort = () => controller.abort(options.signal.reason);
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  const result = await ResultAsync.fromPromise(
    executeCompiled(executionOptions, graph.value, controller),
    () =>
      executionError("ENGINE_FAILED", "Execution engine failed unexpectedly", {
        stage: "execution",
        jobId: options.jobId,
      }),
  );
  options.signal.removeEventListener("abort", abort);

  return result.isErr() ? err(result.error) : result.value;
};
