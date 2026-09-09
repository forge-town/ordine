import { verifyPreparedExecutable } from "./verifyPreparedExecutable";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Result, ResultAsync, type Result as Outcome } from "neverthrow";
import { z } from "zod/v4";
import { validateOperationDefinition, validatePortValues } from "@repo/pipeline-engine";
import {
  ExecutionArtifactNameSchema,
  ExecutionPortIdSchema,
  ExecutionPortValuesSchema,
  ExecutionValueSchema,
  type ExecutionError,
  type ExecutionPortValues,
} from "@repo/schemas";
import { actorError, ExecutionActorError } from "./errors";
import { runScriptProcess } from "./runScriptProcess";
import {
  ExecutionActorLimitsSchema,
  type ExecutionActorContext,
  type ExecutionActorDependencies,
  type ExecutionActorLimits,
} from "./types";

const requireResult = <T, E>(result: Outcome<T, E>): T => {
  if (result.isErr()) throw result.error;

  return result.value;
};
const assertActive = (context: ExecutionActorContext) => {
  if (context.signal.aborted)
    throw new ExecutionActorError("CANCELLED", "Execution was cancelled.");
};
const decodeText = (bytes: Uint8Array) =>
  requireResult(
    Result.fromThrowable(
      () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      () => new ExecutionActorError("SCRIPT_OUTPUT_INVALID", "Output is not valid UTF-8."),
    )(),
  );
const parseJson = (text: string): unknown =>
  requireResult(
    Result.fromThrowable(
      () => JSON.parse(text) as unknown,
      () => new ExecutionActorError("SCRIPT_OUTPUT_INVALID", "Output is not valid JSON."),
    )(),
  );
const ManifestValueSchema = z.union([
  ExecutionValueSchema,
  z.strictObject({
    kind: z.literal("file"),
    relativePath: z.string().min(1).max(1024),
    name: ExecutionArtifactNameSchema,
    mimeType: z.string().min(1).max(128),
  }),
]);
const ManifestSchema = z.strictObject({
  outputs: z
    .record(ExecutionPortIdSchema, z.array(ManifestValueSchema).max(256))
    .refine((values) => Object.keys(values).length <= 64),
});

const decodeOutput = async (
  context: ExecutionActorContext,
  stdout: Uint8Array,
  dependencies: ExecutionActorDependencies,
): Promise<ExecutionPortValues> => {
  const executor = context.operation.executor;
  if (executor.kind !== "script")
    throw new ExecutionActorError("EXECUTOR_KIND_INVALID", "Script executor was required.");
  const text = decodeText(stdout);
  if (executor.outputMode !== "manifest") {
    const output = context.operation.outputPorts[0];
    if (
      context.operation.outputPorts.length !== 1 ||
      !output ||
      output.cardinality !== "one" ||
      output.valueType !== executor.outputMode
    )
      throw new ExecutionActorError(
        "SCRIPT_OUTPUT_CONTRACT_INVALID",
        "Text/JSON scripts require exactly one matching one-valued output port.",
        "validation",
      );
    const outputs = {
      [output.id]: [
        executor.outputMode === "text"
          ? { kind: "text", value: text }
          : { kind: "json", value: parseJson(text) },
      ],
    };
    const parsed = ExecutionPortValuesSchema.safeParse(outputs);
    if (!parsed.success)
      throw new ExecutionActorError(
        "SCRIPT_OUTPUT_INVALID",
        "Output violates the typed inline value contract.",
      );

    return parsed.data;
  }
  const parsed = ManifestSchema.safeParse(parseJson(text));
  if (!parsed.success)
    throw new ExecutionActorError(
      "SCRIPT_OUTPUT_INVALID",
      "Output does not satisfy the explicit manifest contract.",
    );
  for (const [id, values] of Object.entries(parsed.data.outputs)) {
    const port = context.operation.outputPorts.find((candidate) => candidate.id === id);
    if (
      !port ||
      (port.cardinality === "one" && values.length !== 1) ||
      (!port.allowEmpty && values.length === 0) ||
      values.some((value) => (value.kind === "file" ? "artifact" : value.kind) !== port.valueType)
    )
      throw new ExecutionActorError(
        "SCRIPT_OUTPUT_CONTRACT_INVALID",
        "Manifest values violate the declared output ports.",
        "validation",
      );
  }
  if (
    context.operation.outputPorts.some(
      (port) => port.required && !Object.hasOwn(parsed.data.outputs, port.id),
    )
  )
    throw new ExecutionActorError(
      "SCRIPT_OUTPUT_CONTRACT_INVALID",
      "Manifest omits a required output port.",
      "validation",
    );
  const outputs: ExecutionPortValues = {};
  for (const [portId, values] of Object.entries(parsed.data.outputs)) {
    outputs[portId] = [];
    for (const value of values) {
      assertActive(context);
      if (value.kind === "file") {
        const artifact = requireResult(
          await dependencies.artifactStore.registerProducedFile(
            { ...context.artifactContext, portId },
            value,
          ),
        );
        outputs[portId].push({ kind: "artifact", artifactId: artifact.artifactId });
      } else outputs[portId].push(value);
    }
  }

  return outputs;
};

const executeScript = async (
  context: ExecutionActorContext,
  dependencies: ExecutionActorDependencies,
  limits: ExecutionActorLimits,
): Promise<ExecutionPortValues> => {
  const executor = context.operation.executor;
  if (executor.kind !== "script")
    throw new ExecutionActorError("EXECUTOR_KIND_INVALID", "Script executor was required.");
  await verifyPreparedExecutable(context);
  assertActive(context);
  if (
    executor.outputMode !== "manifest" &&
    (context.operation.outputPorts.length !== 1 ||
      context.operation.outputPorts[0]!.cardinality !== "one" ||
      context.operation.outputPorts[0]!.valueType !== executor.outputMode)
  )
    throw new ExecutionActorError(
      "SCRIPT_OUTPUT_CONTRACT_INVALID",
      "Text/JSON scripts require exactly one matching one-valued output port.",
      "validation",
    );
  const workspace = requireResult(
    await dependencies.artifactStore.createAttemptWorkspace(context.artifactContext),
  );
  const sourcePath = join(
    workspace,
    `operation.${executor.language === "javascript" ? "mjs" : executor.language === "python" ? "py" : "sh"}`,
  );
  await writeFile(sourcePath, executor.source, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
    signal: context.signal,
  });
  for (const name of ["inputs", "tmp", "appdata"])
    await mkdir(join(workspace, name), { mode: 0o700 });
  const artifactFiles: Record<
    string,
    { relativePath: string; name: string; mimeType: string; sizeBytes: number; sha256: string }
  > = {};
  const copied = { bytes: 0 };
  for (const values of Object.values(context.inputs))
    for (const value of values) {
      if (value.kind !== "artifact" || artifactFiles[value.artifactId]) continue;
      assertActive(context);
      const read = requireResult(
        await dependencies.artifactStore.readForExecution(
          context.artifactContext,
          value.artifactId,
        ),
      );
      copied.bytes += read.bytes.byteLength;
      if (copied.bytes > limits.maxArtifactInputBytes)
        throw new ExecutionActorError(
          "SCRIPT_INPUT_LIMIT",
          "Input artifacts exceed the configured combined byte limit.",
        );
      const relativePath = `inputs/${randomUUID()}`;
      await writeFile(join(workspace, relativePath), read.bytes, {
        flag: "wx",
        mode: 0o400,
        signal: context.signal,
      });
      artifactFiles[value.artifactId] = {
        relativePath,
        name: read.metadata.name,
        mimeType: read.metadata.mimeType,
        sizeBytes: read.metadata.sizeBytes,
        sha256: read.metadata.sha256,
      };
    }
  const stdin = new TextEncoder().encode(
    JSON.stringify({
      apiVersion: 2,
      jobId: context.jobId,
      nodeId: context.node.id,
      attemptId: context.attemptId,
      iteration: context.iteration,
      attemptNumber: context.attemptNumber,
      sharedContext: context.sharedContext,
      inputs: context.inputs,
      artifactFiles,
    }),
  );
  if (stdin.byteLength > limits.maxInputBytes)
    throw new ExecutionActorError(
      "SCRIPT_INPUT_LIMIT",
      "Structured stdin exceeds the configured byte limit.",
    );
  assertActive(context);
  const outcome = await runScriptProcess({ context, workspace, sourcePath, stdin, limits });
  if (dependencies.onProcessResult) {
    const recorded = await dependencies.onProcessResult(context, outcome.report);
    if (recorded.isErr())
      throw new ExecutionActorError(
        "ACTOR_DIAGNOSTIC_FAILED",
        "Script diagnostic persistence failed.",
      );
  }
  if (outcome.error)
    throw new ExecutionActorError(outcome.error.code, outcome.error.message, outcome.error.stage);
  assertActive(context);

  return decodeOutput(context, outcome.stdout, dependencies);
};

const executeBuiltin = async (
  context: ExecutionActorContext,
  dependencies: ExecutionActorDependencies,
): Promise<ExecutionPortValues> => {
  const executor = context.operation.executor;
  if (executor.kind !== "builtin")
    throw new ExecutionActorError("EXECUTOR_KIND_INVALID", "Builtin executor was required.");
  const input = context.operation.inputPorts[0];
  const output = context.operation.outputPorts[0]!;
  const values = input ? (context.inputs[input.id] ?? []) : [];
  const only = values[0];
  switch (executor.name) {
    case "identity": {
      return { [output.id]: [...values] };
    }
    case "merge_text": {
      if (values.some((value) => value.kind !== "text"))
        throw new ExecutionActorError(
          "BUILTIN_INPUT_INVALID",
          "Merge requires text values.",
          "validation",
        );

      return {
        [output.id]: [
          {
            kind: "text",
            value: values
              .map((value) => (value.kind === "text" ? value.value : ""))
              .join(
                typeof executor.config.separator === "string" ? executor.config.separator : "\n\n",
              ),
          },
        ],
      };
    }
    case "write_artifact": {
      if (values.length !== 1 || !only || only.kind === "artifact")
        throw new ExecutionActorError(
          "BUILTIN_INPUT_INVALID",
          "Write requires one text or JSON value.",
          "validation",
        );
      const content = only.kind === "text" ? only.value : JSON.stringify(only.value);
      const artifact = requireResult(
        await dependencies.artifactStore.writeProduced(
          { ...context.artifactContext, portId: output.id },
          {
            name: executor.config.name as string,
            mimeType: executor.config.mimeType as string,
            bytes: new TextEncoder().encode(content),
          },
        ),
      );

      return { [output.id]: [{ kind: "artifact", artifactId: artifact.artifactId }] };
    }
    case "read_artifact": {
      if (values.length !== 1 || only?.kind !== "artifact")
        throw new ExecutionActorError(
          "BUILTIN_INPUT_INVALID",
          "Read requires one artifact reference.",
          "validation",
        );
      const read = requireResult(
        await dependencies.artifactStore.readForExecution(context.artifactContext, only.artifactId),
      );

      return { [output.id]: [{ kind: "text", value: decodeText(read.bytes) }] };
    }
    case "materialize_file": {
      const read = requireResult(
        await dependencies.artifactStore.readForExecution(
          context.artifactContext,
          executor.config.assetId as string,
        ),
      );
      const artifact = requireResult(
        await dependencies.artifactStore.writeProduced(
          { ...context.artifactContext, portId: output.id },
          { name: read.metadata.name, mimeType: read.metadata.mimeType, bytes: read.bytes },
        ),
      );

      return { [output.id]: [{ kind: "artifact", artifactId: artifact.artifactId }] };
    }
  }
};

/** Attempt working directories isolate files, not OS authority. Preparation must approve script risks. */
export const createExecutionActors = (dependencies: ExecutionActorDependencies) => ({
  execute: async (
    context: ExecutionActorContext,
  ): Promise<Outcome<ExecutionPortValues, ExecutionError>> =>
    ResultAsync.fromPromise(
      (async () => {
        assertActive(context);
        if (
          context.artifactContext.lease.jobId !== context.jobId ||
          context.artifactContext.nodeId !== context.node.id ||
          context.artifactContext.attemptId !== context.attemptId ||
          context.artifactContext.signal !== context.signal ||
          context.resolved.executorKind !== context.operation.executor.kind
        )
          throw new ExecutionActorError(
            "ACTOR_CONTEXT_INVALID",
            "Actor context does not match its execution lease and attempt.",
            "validation",
          );
        requireResult(
          validateOperationDefinition(context.operation).mapErr(
            (error) =>
              new ExecutionActorError(error.code, error.message, error.stage, error.portId),
          ),
        );
        const parsedLimits = ExecutionActorLimitsSchema.safeParse(dependencies.limits ?? {});
        if (!parsedLimits.success)
          throw new ExecutionActorError(
            "ACTOR_LIMITS_INVALID",
            "Execution actor limits are invalid.",
            "validation",
          );
        if (context.operation.executor.kind === "agent")
          throw new ExecutionActorError(
            "AGENT_ACTOR_REQUIRED",
            "Agent execution requires the Agent adapter.",
          );
        const outputs =
          context.operation.executor.kind === "script"
            ? await executeScript(context, dependencies, parsedLimits.data)
            : await executeBuiltin(context, dependencies);
        assertActive(context);
        const validated = requireResult(
          await validatePortValues(context.operation.outputPorts, outputs, async (artifactId) => {
            const read = await dependencies.artifactStore.readForExecution(
              context.artifactContext,
              artifactId,
            );

            return read
              .map(({ metadata }) => ({
                artifactId: metadata.artifactId,
                mimeType: metadata.mimeType,
                sizeBytes: metadata.sizeBytes,
                sha256: metadata.sha256,
              }))
              .mapErr(actorError);
          }).mapErr(
            (error) =>
              new ExecutionActorError(error.code, error.message, error.stage, error.portId),
          ),
        );
        assertActive(context);

        return validated;
      })(),
      (error) =>
        context.signal.aborted &&
        !(
          error instanceof ExecutionActorError &&
          ["SCRIPT_TERMINATION_FAILED", "ACTOR_DIAGNOSTIC_FAILED"].includes(error.code)
        )
          ? actorError(new ExecutionActorError("CANCELLED", "Execution was cancelled."))
          : actorError(error),
    ).mapErr((error) => ({ ...error, jobId: context.jobId, nodeId: context.node.id })),
});
