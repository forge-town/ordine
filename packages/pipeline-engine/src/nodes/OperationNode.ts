import type { PipelineNode, ExecutorConfig, NodeData, NodeCtx } from "../schemas";
import { trace } from "@repo/obs";
import { ScriptExecutionError } from "../errors";
import { runScript, safeParseJson } from "../infrastructure";
import type { OperationNodeContext, OperationExecResult, NodeResult } from "./types";

const CHUNK_THROTTLE_MS = 2000;

export const executeOperationNode = async (
  node: PipelineNode,
  input: NodeCtx,
  ctx: OperationNodeContext,
): Promise<OperationExecResult> => {
  const { deps, operations, jobId } = ctx;
  const data = node.data as NodeData;
  const operationId = data.operationId ?? "";
  const operation = operations.get(operationId);

  if (!operation) {
    await trace(jobId, `WARNING: Operation ${operationId} not found, skipping`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const opData = node.data as unknown as {
    llmModel?: string;
    llmProvider?: string;
    bestPracticeId?: string;
  };
  const modelOverride = opData.llmModel ?? undefined;
  const agentOverride = opData.llmProvider as ExecutorConfig["agent"] | undefined;

  const bestPracticeContent = await (async () => {
    if (!opData.bestPracticeId) return "";
    const bp = await ctx.lookupBestPractice(opData.bestPracticeId);
    if (bp) {
      await trace(jobId, `Loaded best practice "${bp.title}" (${bp.content.length} chars)`);

      return bp.content;
    }
    await trace(
      jobId,
      `WARNING: Best practice ${opData.bestPracticeId} not found, continuing without standards`,
    );

    return "";
  })();

  const configResult = await safeParseJson(operation.config, operation.name);
  if (configResult.isErr()) {
    await trace(jobId, `WARNING: ${configResult.error.message}, skipping`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const config = configResult.value;
  const executor = config.executor;
  if (!executor) {
    await trace(
      jobId,
      `WARNING: No executor configured for operation "${operation.name}", skipping`,
    );
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const rawType = executor.type as string;
  if (rawType === "skill" || rawType === "prompt") {
    executor.agentMode = rawType as "skill" | "prompt";
    executor.type = "agent";
  }

  if (executor.type === "rule-check") {
    await trace(jobId, `Running rule-check on path: ${input.inputPath}`);
    const checkOutput = await deps.runRuleCheck(input.inputPath);
    const checkResult = JSON.stringify(checkOutput, null, 2);
    await trace(
      jobId,
      `Rule-check: ${checkOutput.stats.totalFindings} findings in ${checkOutput.stats.totalFiles} files`,
    );

    return { ok: true, content: checkResult };
  }

  await trace(jobId, `Executing operation "${operation.name}" (${executor.type})`);

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

  const effectiveInput = bestPracticeContent
    ? `## Standards (Best Practice)\n\n${bestPracticeContent}\n\n---\n\n${input.content}`
    : input.content;

  const opResult = { value: "" };

  if (executor.type === "script") {
    const scriptResult = await runScript(executor, input.inputPath, input.content);
    if (scriptResult.isErr()) {
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: scriptResult.error };
    }
    opResult.value = scriptResult.value;
    await trace(jobId, `Script output (${opResult.value.length} chars)`);
  } else if (executor.type === "agent" && executor.agentMode === "prompt") {
    const prompt = (executor as ExecutorConfig & { prompt?: string }).prompt ?? "";
    if (!prompt.trim()) {
      await trace(
        jobId,
        `WARNING: Prompt text is empty for operation "${operation.name}", skipping`,
      );
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: null };
    }
    const promptResult = await deps.runPrompt({
      prompt,
      inputContent: effectiveInput,
      inputPath: input.inputPath,
      modelOverride,
      agent: agentOverride ?? executor.agent,
      onChunk: handleChunk,
      onProgress,
    });
    if (promptResult.isErr()) {
      await trace(jobId, `@@NODE_FAIL::${node.id}`);

      return { ok: false, error: new ScriptExecutionError(promptResult.error.message) };
    }
    opResult.value = promptResult.value;
    await trace(jobId, `@@LLM_CONTENT::${node.id}::${opResult.value}`);
    await trace(jobId, `Prompt output (${opResult.value.length} chars)`);
  } else if (executor.type === "agent" && executor.agentMode === "skill") {
    const skillId = (executor as ExecutorConfig & { skillId?: string }).skillId ?? "";
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

    await trace(jobId, `Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`);
    const skillResult = await deps.runSkill({
      skillId,
      skillDescription,
      inputContent: effectiveInput,
      inputPath: input.inputPath,
      modelOverride,
      agent: agentOverride ?? executor.agent,
      allowedTools: executor.allowedTools,
      promptMode: executor.promptMode,
      onChunk: handleChunk,
      onProgress,
      writeEnabled: (executor as ExecutorConfig & { writeEnabled?: boolean }).writeEnabled === true,
    });
    opResult.value = skillResult.isOk() ? skillResult.value : "";
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
  const opData = node.data as unknown as {
    loopEnabled?: boolean;
    maxLoopCount?: number;
    loopConditionPrompt?: string;
    llmModel?: string;
  };
  const loopEnabled = opData.loopEnabled === true;
  const maxLoops = opData.maxLoopCount ?? 3;
  const conditionPrompt = opData.loopConditionPrompt ?? "";

  const resultState = { content: "" };

  if (loopEnabled && conditionPrompt) {
    const modelOverride = opData.llmModel ?? undefined;
    const loopState = { currentInput: input };

    for (const attempt of Array.from({ length: maxLoops }, (_, i) => i + 1)) {
      await trace(
        jobId,
        `[Loop] Iteration ${attempt}/${maxLoops} for "${(node.data as unknown as Record<string, unknown>).label}"`,
      );
      const loopResult = await executeOperationNode(node, loopState.currentInput, ctx);
      if (!loopResult.ok) {
        if (loopResult.error) return { ok: false, error: loopResult.error };
        break;
      }
      resultState.content = loopResult.content;
      loopState.currentInput = { inputPath: input.inputPath, content: resultState.content };

      const passed = await deps.evaluateLoopCondition(
        conditionPrompt,
        resultState.content,
        modelOverride,
      );
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
