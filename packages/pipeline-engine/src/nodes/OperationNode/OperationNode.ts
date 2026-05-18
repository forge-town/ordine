import type { OperationExecutorConfig, PipelineNode } from "@repo/schemas";
import type { NodeCtx } from "../../schemas";
import { trace } from "@repo/obs";
import { ScriptExecutionError } from "../../errors";
import { runScript, safeParseConfig } from "../../infrastructure";
import type { OperationNodeContext, OperationExecResult, NodeResult } from "../types";

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

export const executeOperationNode = async (
  node: PipelineNode,
  input: NodeCtx,
  ctx: OperationNodeContext,
): Promise<OperationExecResult> => {
  const { deps, operations, jobId } = ctx;

  if (node.data.nodeType !== "operation") {
    await trace(jobId, `WARNING: Expected operation node, got ${node.data.nodeType ?? "unknown"}`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const data = node.data;
  const operationId = data.operationId ?? "";
  const operation = operations.get(operationId);

  if (!operation) {
    await trace(jobId, `WARNING: Operation ${operationId} not found, skipping`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
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
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const config = configResult.value;
  const executor = config.executor;
  await trace(jobId, `Operation outputs: ${JSON.stringify(config.outputs)}`);
  if (!executor) {
    await trace(
      jobId,
      `WARNING: No executor configured for operation "${operation.name}", skipping`,
    );
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  await trace(jobId, `Executing operation "${operation.name}" (${executor.type})`);

  const effectiveAgentMode =
    executor.agentMode ?? (executor.type === "agent" ? "prompt" : undefined);

  const chunkState = { lastTime: 0 };
  const handleChunk = async (accumulated: string) => {
    const now = Date.now();
    if (now - chunkState.lastTime >= CHUNK_THROTTLE_MS) {
      chunkState.lastTime = now;
      await trace(jobId, `@@LLM_CONTENT::${node.id}::${accumulated}`);
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
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: scriptResult.error };
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
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: null };
    }
    const extraTools: string[] = input.githubRemote ? [...GH_REMOTE_TOOLS] : [];
    const promptResult = await deps.runPrompt({
      prompt,
      inputContent: effectiveInput,
      inputPath: input.inputPath,
      agent: agentOverride ?? executor.agent,
      onChunk: handleChunk,
      onProgress,
      extraTools: extraTools.length > 0 ? extraTools : undefined,
      githubToken: input.githubRemote ? ctx.githubToken : undefined,
      outputItems: config.outputs.length > 0 ? config.outputs : undefined,
      outputDir: ctx.outputDir,
    });
    if (promptResult.isErr()) {
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: new ScriptExecutionError(promptResult.error.message) };
    }
    opResult.value = promptResult.value;
    await trace(jobId, `@@LLM_CONTENT::${node.id}::${opResult.value}`);
    await trace(jobId, `Prompt output (${opResult.value.length} chars)`);
  } else if (executor.type === "agent" && effectiveAgentMode === "skill") {
    const skillId = executor.skillId ?? "";
    if (!skillId) {
      await trace(
        jobId,
        `WARNING: No skillId configured for operation "${operation.name}", skipping`,
      );
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: null };
    }

    const skill = await ctx.lookupSkill(skillId);
    const skillDescription = skill
      ? `${skill.label}: ${skill.description}`
      : `Skill "${skillId}" (no description available)`;
    const agent = agentOverride ?? executor.agent;

    if (agent === "hermes") {
      const message = `Hermes is not available for skill operation "${operation.name}" because skills require local tool permissions`;
      await trace(
        jobId,
        `WARNING: ${message}`,
      );
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: new ScriptExecutionError(message) };
    }

    await trace(jobId, `Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`);
    const skillResult = await deps.runSkill({
      skillId,
      skillDescription,
      systemPrompt: executor.systemPrompt,
      inputContent: effectiveInput,
      inputPath: input.inputPath,
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
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: new ScriptExecutionError(skillResult.error.message) };
    }
    await trace(jobId, `@@LLM_CONTENT::${node.id}::${opResult.value}`);
    await trace(jobId, `Skill output (${opResult.value.length} chars)`);
  }

  return { ok: true, content: opResult.value };
};

export const processOperationNode = async (
  node: PipelineNode,
  input: NodeCtx,
  ctx: OperationNodeContext,
): Promise<NodeResult> => {
  const { deps, nodeOutputs, jobId } = ctx;

  if (node.data.nodeType !== "operation") {
    await trace(jobId, `WARNING: Expected operation node, got ${node.data.nodeType ?? "unknown"}`);

    return { ok: false, error: new ScriptExecutionError(`Expected operation node`) };
  }

  const loopEnabled = node.data.loopEnabled === true;
  const maxLoops = node.data.maxLoopCount ?? 3;
  const conditionPrompt = node.data.loopConditionPrompt ?? "";

  const resultState = { content: "" };

  if (loopEnabled && conditionPrompt) {
    const loopState = { currentInput: input };

    for (const attempt of Array.from({ length: maxLoops }, (_, i) => i + 1)) {
      await trace(jobId, `[Loop] Iteration ${attempt}/${maxLoops} for "${node.data.label}"`);
      const loopResult = await executeOperationNode(node, loopState.currentInput, ctx);
      if (!loopResult.ok) {
        if (loopResult.error) return { ok: false, error: loopResult.error };
        break;
      }
      resultState.content = loopResult.content;
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
    if (nodeResult.ok) {
      resultState.content = nodeResult.content;
      if (!resultState.content) {
        await trace(jobId, `WARNING: Operation returned empty output — using parent input`);
        resultState.content = input.content;
      }
    } else if (nodeResult.error) {
      return { ok: false, error: nodeResult.error };
    }
  }

  nodeOutputs.set(node.id, { inputPath: input.inputPath, content: resultState.content });
  await trace(jobId, `@@NODE_DONE::${node.id}`);

  return { ok: true };
};
