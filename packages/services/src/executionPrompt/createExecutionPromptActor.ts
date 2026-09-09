import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ResultAsync, Result, err, type Result as Outcome } from "neverthrow";
import { z } from "zod/v4";
import { validateOperationDefinition, validatePortValues } from "@repo/pipeline-engine";
import {
  ExecutionPortValuesSchema,
  type ExecutionError,
  type ExecutionPortValues,
} from "@repo/schemas";
import {
  runNativeProcess,
  verifyPreparedExecutable,
  ExecutionActorLimitsSchema,
  type ExecutionActorContext,
} from "../executionActors";
import { ExecutionActorError } from "../executionActors/errors";
import { ArtifactStoreError } from "../executionArtifacts";
import { cleanupCodexCredentials, prepareCodexHome } from "./codexHome";
import { createCodexStream } from "./codexStream";
import { ExecutionPromptError, parsePromptJson, promptError, requirePromptResult } from "./errors";
import { ExecutionPromptLimitsSchema, type ExecutionPromptDependencies } from "./types";

const disabledFeatures = [
  "apps",
  "browser_use",
  "browser_use_external",
  "browser_use_full_cdp_access",
  "computer_use",
  "image_generation",
  "in_app_browser",
  "js_repl",
  "multi_agent",
  "multi_agent_v2",
  "plugins",
  "search_tool",
  "shell_tool",
  "skill_mcp_dependency_install",
  "skill_search",
  "standalone_web_search",
  "unified_exec",
  "view_image",
  "workspace_dependencies",
  "hooks",
  "memories",
  "goals",
  "sleep_tool",
  "code_mode",
  "tool_suggest",
  "recommended_plugins",
  "remote_plugin",
];
const catalogSchema = z.object({
  models: z.array(
    z.object({
      slug: z.string(),
      supported_reasoning_levels: z.array(z.object({ effort: z.string() })),
      service_tiers: z.array(z.object({ id: z.string() })).optional(),
    }),
  ),
});
const toError = (error: unknown): ExecutionError =>
  error instanceof ExecutionActorError || error instanceof ArtifactStoreError
    ? { code: error.code, message: error.message, stage: error.stage, retryable: false }
    : promptError(error);
const fromContract = (error: ExecutionError) =>
  new ExecutionPromptError(error.code, error.message, error.stage);
const active = (context: ExecutionActorContext) => {
  if (context.signal.aborted)
    throw new ExecutionPromptError("CANCELLED", "Prompt execution was cancelled.");
};

export const createExecutionPromptActor = (dependencies: ExecutionPromptDependencies) => ({
  execute: async (
    context: ExecutionActorContext,
  ): Promise<Outcome<ExecutionPortValues, ExecutionError>> => {
    const cleanup: { home?: string } = {};
    const result = await ResultAsync.fromPromise(
      (async () => {
        active(context);
        requirePromptResult(validateOperationDefinition(context.operation).mapErr(fromContract));
        const executor = context.operation.executor;
        const output = context.operation.outputPorts[0];
        if (
          executor.kind !== "agent" ||
          context.resolved.executorKind !== "agent" ||
          context.resolved.agent !== "codex" ||
          executor.allowedTools.length > 0 ||
          executor.skillId ||
          context.operation.capabilityRefs.length > 0 ||
          !output ||
          context.operation.outputPorts.length !== 1 ||
          output.cardinality !== "one" ||
          !["text", "json"].includes(output.valueType)
        )
          throw new ExecutionPromptError(
            "PROMPT_CONTRACT_UNSUPPORTED",
            "Codex prompt execution requires no tools or skills and one text/JSON output.",
            "validation",
          );
        if (
          !context.resolved.model ||
          !context.resolved.reasoningEffort ||
          !context.resolved.speed ||
          !["standard", "priority"].includes(context.resolved.speed)
        )
          throw new ExecutionPromptError(
            "PROMPT_OPTIONS_UNSUPPORTED",
            "Prompt execution requires explicit model, reasoning effort and standard/priority speed.",
            "preparation",
          );
        if (
          context.artifactContext.lease.jobId !== context.jobId ||
          context.artifactContext.nodeId !== context.node.id ||
          context.artifactContext.attemptId !== context.attemptId ||
          context.artifactContext.signal !== context.signal
        )
          throw new ExecutionPromptError(
            "PROMPT_CONTEXT_INVALID",
            "Prompt attempt context is inconsistent.",
            "validation",
          );
        await verifyPreparedExecutable(context);
        const limits = ExecutionPromptLimitsSchema.parse(dependencies.limits ?? {});
        const workspace = requirePromptResult(
          await dependencies.artifactStore.createAttemptWorkspace(context.artifactContext),
        );
        for (const name of ["tmp", "appdata"])
          await mkdir(join(workspace, name), { recursive: true, mode: 0o700 });
        const home = join(workspace, "codex-home");
        cleanup.home = home;
        if (context.credentialRefs?.length !== 1)
          throw new ExecutionPromptError(
            "PROMPT_CREDENTIAL_REQUIRED",
            "Prompt execution requires the prepared credential reference.",
            "preparation",
          );
        const { environment, redact } = await prepareCodexHome(home, context.credentialRefs[0]!);
        const control = new AbortController();
        const signal = AbortSignal.any([context.signal, control.signal]);
        const runtimeContext = {
          ...context,
          signal,
          artifactContext: { ...context.artifactContext, signal },
        };
        const processLimits = ExecutionActorLimitsSchema.parse({
          maxStdoutBytes: limits.maxStreamBytes,
          maxOutputBytes: limits.maxStreamBytes + 256 * 1024,
          maxDurationMs: Math.min(context.resolved.timeouts.activeRunTimeoutMs, 86_400_000),
        });
        const probe = async (args: string[]) => {
          active(context);
          const outcome = await runNativeProcess({
            context: {
              ...runtimeContext,
              resolved: {
                ...context.resolved,
                timeouts: {
                  ...context.resolved.timeouts,
                  firstOutputTimeoutMs: 0,
                  inactivityTimeoutMs: 30_000,
                },
              },
            },
            workspace,
            environment,
            stdin: new Uint8Array(),
            arguments: args,
            limits: {
              ...processLimits,
              maxStdoutBytes: 8 * 1024 * 1024,
              maxOutputBytes: 9 * 1024 * 1024,
              maxDurationMs: 30_000,
            },
          });
          if (outcome.error)
            throw new ExecutionPromptError(
              "PROMPT_CLI_UNSUPPORTED",
              "Frozen Codex CLI capability validation failed.",
              "preparation",
            );

          return new TextDecoder("utf-8", { fatal: true }).decode(outcome.stdout);
        };
        const help = await probe(["exec", "--help"]);
        for (const flag of [
          "--strict-config",
          "--ignore-rules",
          "--ephemeral",
          "--output-schema",
          "--json",
          "--model",
          "--disable",
          "--sandbox",
        ])
          if (!help.includes(flag))
            throw new ExecutionPromptError(
              "PROMPT_CLI_UNSUPPORTED",
              "Frozen Codex CLI lacks required prompt controls.",
              "preparation",
            );
        const features = await probe(["features", "list"]);
        const supportedFeatures = new Set(
          features.split(/\r?\n/u).map((line) => line.trim().split(/\s+/u)[0]),
        );
        for (const feature of disabledFeatures)
          if (!supportedFeatures.has(feature))
            throw new ExecutionPromptError(
              "PROMPT_CLI_UNSUPPORTED",
              "Frozen Codex CLI lacks a required tool isolation feature.",
              "preparation",
            );
        const catalog = catalogSchema.safeParse(
          parsePromptJson(await probe(["debug", "models", "--bundled"])),
        );
        const model = catalog.success
          ? catalog.data.models.find((candidate) => candidate.slug === context.resolved.model)
          : undefined;
        if (
          !model ||
          !model.supported_reasoning_levels.some(
            (level) => level.effort === context.resolved.reasoningEffort,
          ) ||
          (context.resolved.speed === "priority" &&
            !model.service_tiers?.some((tier) => tier.id === "priority"))
        )
          throw new ExecutionPromptError(
            "PROMPT_OPTIONS_UNSUPPORTED",
            "Frozen Codex CLI does not support the resolved model, effort or speed.",
            "preparation",
          );
        const artifactInputs: Record<string, unknown> = {};
        for (const values of Object.values(context.inputs))
          for (const value of values) {
            if (value.kind !== "artifact" || Object.hasOwn(artifactInputs, value.artifactId))
              continue;
            active(context);
            const read = requirePromptResult(
              await dependencies.artifactStore.readForExecution(
                context.artifactContext,
                value.artifactId,
              ),
            );
            const decoded = Result.fromThrowable(
              () => new TextDecoder("utf-8", { fatal: true }).decode(read.bytes),
              () => undefined,
            )();
            if (decoded.isErr())
              throw new ExecutionPromptError(
                "PROMPT_ARTIFACT_UNSUPPORTED",
                "Prompt-only Codex inputs require UTF-8 artifact content.",
                "validation",
              );
            artifactInputs[value.artifactId] = {
              name: read.metadata.name,
              mimeType: read.metadata.mimeType,
              sizeBytes: read.metadata.sizeBytes,
              sha256: read.metadata.sha256,
              encoding: "utf8",
              content: decoded.value,
            };
          }
        const prompt = JSON.stringify({
          apiVersion: 2,
          mode: "prompt-only",
          systemPrompt: executor.systemPrompt ?? "",
          instruction: executor.instruction,
          output: { valueType: output.valueType, jsonSchema: output.jsonSchema },
          context: {
            jobId: context.jobId,
            nodeId: context.node.id,
            attemptId: context.attemptId,
            iteration: context.iteration,
            attemptNumber: context.attemptNumber,
            sharedContext: context.sharedContext,
          },
          inputs: context.inputs,
          artifactInputs,
        });
        const stdin = Buffer.from(prompt, "utf8");
        if (stdin.byteLength > limits.maxPromptBytes)
          throw new ExecutionPromptError(
            "PROMPT_INPUT_LIMIT",
            "Complete prompt exceeds its byte limit; no content was truncated.",
            "validation",
          );
        const args = [
          "exec",
          "--json",
          "--skip-git-repo-check",
          "--ephemeral",
          "--strict-config",
          "--ignore-rules",
          "--sandbox",
          "read-only",
          "--color",
          "never",
          "--model",
          context.resolved.model,
          "-c",
          `model_reasoning_effort=${JSON.stringify(context.resolved.reasoningEffort)}`,
          "-c",
          `service_tier=${JSON.stringify(context.resolved.speed === "standard" ? "default" : "priority")}`,
          "-c",
          "features.skip_host_skill_discovery=true",
          ...disabledFeatures.flatMap((feature) => ["--disable", feature]),
        ];
        if (output.valueType === "json" && output.jsonSchema) {
          const schemaPath = join(workspace, "response-schema.json");
          await writeFile(schemaPath, JSON.stringify(output.jsonSchema), {
            encoding: "utf8",
            flag: "wx",
            mode: 0o600,
          });
          args.push("--output-schema", schemaPath);
        }
        args.push("-");
        const stream = createCodexStream({
          limits,
          redact,
          abort: () => control.abort(),
          onEvent: dependencies.onRuntimeEvent
            ? (event) => dependencies.onRuntimeEvent!(context, event)
            : undefined,
        });
        stream.emit({ type: "status", phase: "starting" });
        const outcome = await runNativeProcess({
          context: runtimeContext,
          workspace,
          environment,
          stdin,
          arguments: args,
          limits: processLimits,
          onStdout: stream.consume,
          hasFirstOutput: stream.hasFirstOutput,
        });
        const initialDelivery = await stream.settle();
        requirePromptResult(initialDelivery.mapErr(fromContract));
        if (outcome.error) {
          stream.emit({
            type: "terminal",
            status: context.signal.aborted ? "cancelled" : "failed",
            exitCode: outcome.report.exitCode,
          });
          const failureDelivery = await stream.settle();
          requirePromptResult(failureDelivery.mapErr(fromContract));
          throw fromContract(outcome.error);
        }
        const postprocessed = await ResultAsync.fromPromise(
          (async () => {
            const completion = stream.completion();
            const parsedValues = ExecutionPortValuesSchema.safeParse({
              [output.id]: [
                output.valueType === "json"
                  ? { kind: "json", value: parsePromptJson(completion.text) }
                  : { kind: "text", value: completion.text },
              ],
            });
            if (!parsedValues.success)
              throw new ExecutionPromptError(
                "PROMPT_OUTPUT_INVALID",
                "Prompt response violates the typed inline output contract.",
              );
            const validated = requirePromptResult(
              await validatePortValues(
                context.operation.outputPorts,
                parsedValues.data,
                async () => {
                  throw new ExecutionPromptError(
                    "PROMPT_CONTRACT_UNSUPPORTED",
                    "Prompt output cannot contain artifacts.",
                  );
                },
              ).mapErr(fromContract),
            );
            active(context);

            return { validated, completion };
          })(),
          toError,
        );
        if (postprocessed.isErr()) {
          stream.emit({
            type: "diagnostic",
            level: "error",
            code: postprocessed.error.code,
            message: postprocessed.error.message,
          });
          stream.emit({ type: "terminal", status: "failed", exitCode: outcome.report.exitCode });
          const failureDelivery = await stream.settle();
          requirePromptResult(failureDelivery.mapErr(fromContract));
          throw fromContract(postprocessed.error);
        }
        stream.emit({
          type: "terminal",
          status: "completed",
          exitCode: outcome.report.exitCode,
          sessionId: postprocessed.value.completion.sessionId,
        });
        const finalDelivery = await stream.settle();
        requirePromptResult(finalDelivery.mapErr(fromContract));

        return postprocessed.value.validated;
      })(),
      toError,
    );
    if (cleanup.home) {
      const cleaned = await ResultAsync.fromPromise(cleanupCodexCredentials(cleanup.home), toError);
      if (cleaned.isErr()) return err(cleaned.error);
    }

    return result.mapErr((error) => ({ ...error, jobId: context.jobId, nodeId: context.node.id }));
  },
});
