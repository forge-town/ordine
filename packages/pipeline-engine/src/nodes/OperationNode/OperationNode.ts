import {
  encodeLlmContent,
  encodeNodeArtifact,
  encodeNodeDone,
  encodeNodeFail,
  type OperationExecutorConfig,
  type PipelineNode,
} from "@repo/schemas";
import type { NodeCtx, OperationRuntimeContext } from "../../schemas";
import { trace } from "@repo/obs";
import { ScriptExecutionError } from "../../errors";
import { runScript, safeParseConfig } from "../../infrastructure";
import type { OperationNodeContext, OperationExecResult, NodeResult } from "../types";
import { captureOutputArtifact } from "./captureOutputArtifact";

const GH_REMOTE_TOOLS = [
  "Read",
  "Bash(find:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(cat:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(wc:*)",
  "Bash(ls:*)",
  "Bash(tree:*)",
  "Bash(gh:*)",
] as const;

const CHUNK_THROTTLE_MS = 2000;

// The pipeline section is only included when the engine injects a pipelineContext,
// keeping pipeline-wide shared context separate from this operation's local duties.
const buildRuntimeContext = ({
  ctx,
  operationName,
  operationDescription,
  instruction,
}: {
  ctx: OperationNodeContext;
  operationName: string;
  operationDescription: string;
  instruction?: string;
}): OperationRuntimeContext => ({
  ...(ctx.pipelineContext ? { pipeline: ctx.pipelineContext } : {}),
  operation: {
    name: operationName,
    description: operationDescription,
    ...(instruction ? { instruction } : {}),
  },
});

export const executeOperationNode = async (
  node: PipelineNode,
  input: NodeCtx,
  ctx: OperationNodeContext,
): Promise<OperationExecResult> => {
  const { deps, operations, jobId } = ctx;

  if (node.data.nodeType !== "operation") {
    await trace(jobId, `WARNING: Expected operation node, got ${node.data.nodeType ?? "unknown"}`);
    await trace(jobId, encodeNodeFail(node.id));

    return { outcome: "soft-failed" };
  }

  const data = node.data;
  const operationId = data.operationId ?? "";
  const operation = operations.get(operationId);

  if (!operation) {
    await trace(jobId, `ERROR: Operation ${operationId} not found`);
    await trace(jobId, encodeNodeFail(node.id));

    return {
      outcome: "failed",
      error: new ScriptExecutionError(`Operation "${operationId}" not found`),
    };
  }

  const agentOverride = await (async () => {
    if (data.agentId) {
      const agent = await ctx.lookupAgent(data.agentId);
      if (agent?.defaultRuntime) {
        await trace(jobId, `Using agent "${agent.name}" with runtime "${agent.defaultRuntime}"`);

        return agent.defaultRuntime as OperationExecutorConfig["agent"];
      }
      await trace(
        jobId,
        `WARNING: Agent ${data.agentId} not found or has no runtime, falling back`,
      );
    }

    return data.agentRuntime as OperationExecutorConfig["agent"] | undefined;
  })();

  const configResult = await safeParseConfig(operation.config, operation.name);
  if (configResult.isErr()) {
    await trace(jobId, `WARNING: ${configResult.error.message}, skipping`);
    await trace(jobId, encodeNodeFail(node.id));

    return { outcome: "soft-failed" };
  }

  const config = configResult.value;
  const executor = config.executor;
  await trace(jobId, `Operation outputs: ${JSON.stringify(config.outputs)}`);
  if (!executor) {
    await trace(
      jobId,
      `WARNING: No executor configured for operation "${operation.name}", skipping`,
    );
    await trace(jobId, encodeNodeFail(node.id));

    return { outcome: "soft-failed" };
  }

  await trace(jobId, `Executing operation "${operation.name}" (${executor.type})`);

  const effectiveAgentMode =
    executor.agentMode ?? (executor.type === "agent" ? "prompt" : undefined);

  // lastContent tracks the most recently emitted LLM_CONTENT so the final emit can dedupe:
  // the last streamed frame's accumulated text often equals the final full text, and
  // emitting it again on completion would write a duplicate trace entry.
  const chunkState = { lastContent: "", lastTime: 0 };
  const handleChunk = async (accumulated: string) => {
    const now = Date.now();
    if (now - chunkState.lastTime >= CHUNK_THROTTLE_MS) {
      chunkState.lastTime = now;
      chunkState.lastContent = accumulated;
      await trace(jobId, encodeLlmContent(node.id, accumulated));
    }
  };

  // Final emit: only send if it differs from the last streamed emit, to avoid adjacent duplicates.
  const traceFinalLlmContent = async (content: string) => {
    if (content !== chunkState.lastContent) {
      chunkState.lastContent = content;
      await trace(jobId, encodeLlmContent(node.id, content));
    }
  };

  const onProgress = async (line: string) => {
    await trace(jobId, line);
  };

  const effectiveInput = input.content;

  const opResult = { value: "" };

  if (executor.type === "script") {
    const scriptResult = await runScript(executor, input.inputPath, input.content);
    if (scriptResult.isErr()) {
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "failed", error: scriptResult.error };
    }
    opResult.value = scriptResult.value;
    await trace(jobId, `Script output (${opResult.value.length} chars)`);
  } else if (executor.type === "agent" && effectiveAgentMode === "prompt") {
    const prompt = executor.prompt ?? executor.systemPrompt ?? "";
    if (!prompt.trim()) {
      await trace(
        jobId,
        `WARNING: Prompt text is empty for operation "${operation.name}", skipping`,
      );
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "soft-failed" };
    }
    const extraTools: string[] = input.githubRemote ? [...GH_REMOTE_TOOLS] : [];
    const promptResult = await deps.runPrompt({
      prompt,
      inputContent: effectiveInput,
      inputPath: input.inputPath,
      runtimeContext: buildRuntimeContext({
        ctx,
        operationName: operation.name,
        operationDescription: operation.description ?? "",
        instruction: prompt,
      }),
      agent: agentOverride ?? executor.agent,
      onChunk: handleChunk,
      onProgress,
      extraTools: extraTools.length > 0 ? extraTools : undefined,
      githubToken: input.githubRemote ? ctx.githubToken : undefined,
      outputItems: config.outputs.length > 0 ? config.outputs : undefined,
      outputDir: ctx.outputDir,
    });
    if (promptResult.isErr()) {
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "failed", error: new ScriptExecutionError(promptResult.error.message) };
    }
    opResult.value = promptResult.value;
    await traceFinalLlmContent(opResult.value);
    await trace(jobId, `Prompt output (${opResult.value.length} chars)`);
  } else if (executor.type === "agent" && effectiveAgentMode === "skill") {
    const skillId = executor.skillId ?? "";
    if (!skillId) {
      await trace(
        jobId,
        `WARNING: No skillId configured for operation "${operation.name}", skipping`,
      );
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "soft-failed" };
    }

    const skill = await ctx.lookupSkill(skillId);
    const skillDescription = skill
      ? `${skill.label}: ${skill.description}`
      : `Skill "${skillId}" (no description available)`;
    const agent = agentOverride ?? executor.agent;

    if (agent === "hermes") {
      const message = `Hermes is not available for skill operation "${operation.name}" because skills require local tool permissions`;
      await trace(jobId, `WARNING: ${message}`);
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "failed", error: new ScriptExecutionError(message) };
    }

    await trace(jobId, `Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`);
    const skillResult = await deps.runSkill({
      skillId,
      skillDescription,
      systemPrompt: executor.systemPrompt,
      inputContent: effectiveInput,
      inputPath: input.inputPath,
      runtimeContext: buildRuntimeContext({
        ctx,
        operationName: operation.name,
        operationDescription: operation.description ?? "",
        instruction: skillDescription,
      }),
      agent,
      allowedTools: executor.allowedTools,
      onChunk: handleChunk,
      onProgress,
      outputItems: config.outputs.length > 0 ? config.outputs : undefined,
      outputDir: ctx.outputDir,
    });
    opResult.value = skillResult.isOk() ? skillResult.value : "";
    if (skillResult.isErr()) {
      await trace(jobId, `Skill "${skillId}" failed: ${skillResult.error.message}`);
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "failed", error: new ScriptExecutionError(skillResult.error.message) };
    }
    await traceFinalLlmContent(opResult.value);
    await trace(jobId, `Skill output (${opResult.value.length} chars)`);
  } else if (executor.type === "publish") {
    const publish = executor.publish;
    if (!publish) {
      await trace(jobId, encodeNodeFail(node.id));

      return {
        outcome: "failed",
        error: new ScriptExecutionError("Publish executor requires a publish config"),
      };
    }
    if (!ctx.outputDir) {
      await trace(jobId, encodeNodeFail(node.id));

      return {
        outcome: "failed",
        error: new ScriptExecutionError("Publish has no source directory (no outputDir resolved)"),
      };
    }
    if (!deps.publishArtifact) {
      await trace(jobId, encodeNodeFail(node.id));

      return {
        outcome: "failed",
        error: new ScriptExecutionError(
          "Publish is not supported by this runtime (missing publishArtifact dependency)",
        ),
      };
    }
    const repo = publish.target === "git" ? publish.repo : publish.outputDir;
    await trace(jobId, `Publishing ${ctx.outputDir} → ${publish.target}:${repo}`);
    const publishResult = await deps.publishArtifact({
      sourceDir: ctx.outputDir,
      target: publish.target,
      repo,
      ...(publish.target === "git"
        ? {
            branch: publish.branch,
            subPath: publish.subPath,
            commitMessage: publish.commitMessage,
            openPr: publish.openPr,
          }
        : {}),
      githubToken: ctx.githubToken,
      jobId,
      onProgress,
    });
    if (publishResult.isErr()) {
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "failed", error: new ScriptExecutionError(publishResult.error.message) };
    }
    opResult.value = publishResult.value;
    await trace(jobId, `Publish done: ${opResult.value}`);
  }

  return { outcome: "completed", content: opResult.value };
};

export const processOperationNode = async (
  node: PipelineNode,
  input: NodeCtx,
  ctx: OperationNodeContext,
): Promise<NodeResult> => {
  const { deps, nodeOutputs, jobId } = ctx;

  if (node.data.nodeType !== "operation") {
    await trace(jobId, `WARNING: Expected operation node, got ${node.data.nodeType ?? "unknown"}`);

    return { outcome: "failed", error: new ScriptExecutionError(`Expected operation node`) };
  }

  const loopEnabled = node.data.loopEnabled === true;
  const maxLoops = node.data.maxLoopCount ?? 3;
  const conditionPrompt = node.data.loopConditionPrompt ?? "";

  const resultState = { content: "" };
  // Record the execution start time and a success flag: artifact capture only runs on real
  // success, and only picks up files written during this execution window (mtime >= startedAt),
  // so leftovers from other nodes or earlier runs in the shared outputDir aren't misattributed.
  const exec = { startedAt: Date.now(), succeeded: false };

  if (loopEnabled && conditionPrompt) {
    const loopState = { currentInput: input };

    for (const attempt of Array.from({ length: maxLoops }, (_, i) => i + 1)) {
      await trace(jobId, `[Loop] Iteration ${attempt}/${maxLoops} for "${node.data.label}"`);
      const loopResult = await executeOperationNode(node, loopState.currentInput, ctx);
      if (loopResult.outcome === "failed") return loopResult;
      if (loopResult.outcome === "soft-failed") {
        // No iteration succeeded yet: surface the soft failure instead of continuing empty.
        if (!exec.succeeded) return loopResult;
        break;
      }
      resultState.content = loopResult.content;
      exec.succeeded = true;
      loopState.currentInput = { inputPath: input.inputPath, content: resultState.content };

      const passed = await deps.evaluateLoopCondition(conditionPrompt, resultState.content);
      if (passed) {
        await trace(jobId, `[Loop] Condition PASSED on iteration ${attempt}`);
        break;
      }
      if (attempt === maxLoops) {
        await trace(
          jobId,
          `[Loop] Max iterations (${maxLoops}) reached — proceeding with last result`,
        );
      } else {
        await trace(jobId, `[Loop] Condition FAILED — retrying...`);
      }
    }
  } else {
    const nodeResult = await executeOperationNode(node, input, ctx);
    // Propagate soft failures instead of continuing with an empty output: recording
    // nothing keeps this node's outgoing edges inactive so downstream nodes skip.
    if (nodeResult.outcome !== "completed") return nodeResult;
    resultState.content = nodeResult.content;
    exec.succeeded = true;
    if (!resultState.content) {
      await trace(jobId, `WARNING: Operation returned empty output — using parent input`);
      resultState.content = input.content;
    }
  }

  nodeOutputs.set(node.id, { inputPath: input.inputPath, content: resultState.content });

  // Capture only on real success: exec.succeeded excludes soft-skip fall-through, and
  // startedAt excludes leftovers from other nodes/earlier runs in the shared outputDir.
  // An empty output falling back to the parent input still captures file-only runs.
  const artifact = exec.succeeded
    ? await captureOutputArtifact(ctx.outputDir, node.data.label, exec.startedAt)
    : null;
  if (artifact) {
    await trace(jobId, encodeNodeArtifact(node.id, artifact));
  }

  await trace(jobId, encodeNodeDone(node.id));

  return { outcome: "completed" };
};
