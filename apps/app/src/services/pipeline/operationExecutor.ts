import { streamText } from "ai";
import { ResultAsync } from "neverthrow";
import { runPrompt as runPromptAgent, runSkill as runSkillAgent } from "@/mastra";
import { skillsDao, bestPracticesDao, rulesDao } from "@repo/models";
import type { PipelineNode } from "@repo/db-schema";
import {
  ScriptExecutionError,
  ConfigParseError,
  type NodeData,
  type NodeCtx,
  type OperationConfig,
  type PipelineRunError,
  type PipelineExecutionCtx,
} from "./types";
import { runScript } from "./infrastructure";

const safeParseJson = (
  raw: string,
  operationName: string,
): ResultAsync<OperationConfig, ConfigParseError> =>
  ResultAsync.fromPromise(
    Promise.resolve(JSON.parse(raw) as OperationConfig),
    (cause) => new ConfigParseError(operationName, cause),
  );

export const evaluateLoopCondition = async (
  ctx: PipelineExecutionCtx,
  conditionPrompt: string,
  operationOutput: string,
  modelOverride?: string,
): Promise<boolean> => {
  const model = await ctx.getModel(modelOverride);
  if (!model) {
    await ctx.log(`[Loop] No LLM configured — treating condition as PASS`);
    return true;
  }
  const evalPrompt = `You are a strict evaluator. Given the following acceptance criteria and the operation output, determine if the output meets the criteria.

## Acceptance Criteria
${conditionPrompt}

## Operation Output
${operationOutput}

Respond with EXACTLY one word: "PASS" if the criteria are met, or "FAIL" if not. Do not explain.`;

  const result = streamText({ model, prompt: evalPrompt });
  const chunks: string[] = [];
  for await (const chunk of result.textStream) {
    chunks.push(chunk);
  }
  const verdict = chunks.join("").trim().toUpperCase();
  await ctx.log(`[Loop] Condition evaluation result: ${verdict}`);
  return verdict.startsWith("PASS");
};

export const executeOperationNode = async (
  ctx: PipelineExecutionCtx,
  node: PipelineNode,
  input: NodeCtx,
): Promise<{ ok: true; content: string } | { ok: false; error: PipelineRunError | null }> => {
  const data = node.data as unknown as NodeData;
  const operationId = data.operationId ?? "";
  const operation = ctx.operationsMap.get(operationId);

  if (!operation) {
    await ctx.log(`WARNING: Operation ${operationId} not found, skipping`);
    await ctx.log(`@@NODE_FAIL::${node.id}`);
    return { ok: false, error: null };
  }

  const opData = node.data as unknown as {
    llmModel?: string;
    bestPracticeId?: string;
  };
  const modelOverride = opData.llmModel ?? undefined;

  const bestPracticeContent = await (async () => {
    if (!opData.bestPracticeId) return "";
    const bp = await bestPracticesDao.findById(opData.bestPracticeId);
    if (bp) {
      await ctx.log(`Loaded best practice "${bp.title}" (${bp.content.length} chars)`);
      return bp.content;
    }
    await ctx.log(
      `WARNING: Best practice ${opData.bestPracticeId} not found, continuing without standards`,
    );
    return "";
  })();

  const configResult = await safeParseJson(operation.config, operation.name);
  if (configResult.isErr()) {
    await ctx.log(`WARNING: ${configResult.error.message}, skipping`);
    await ctx.log(`@@NODE_FAIL::${node.id}`);
    return { ok: false, error: null };
  }

  const config = configResult.value;
  const executor = config.executor;
  if (!executor) {
    await ctx.log(`WARNING: No executor configured for operation "${operation.name}", skipping`);
    await ctx.log(`@@NODE_FAIL::${node.id}`);
    return { ok: false, error: null };
  }

  const rawType = executor.type as string;
  if (rawType === "skill" || rawType === "prompt") {
    executor.agentMode = rawType as "skill" | "prompt";
    executor.type = "agent";
  }

  if (executor.type === "rule-check") {
    const { runRuleCheck } = await import("@repo/services");
    await ctx.log(`Running rule-check on path: ${input.inputPath}`);
    const checkOutput = await runRuleCheck(rulesDao, input.inputPath);
    const checkResult = JSON.stringify(checkOutput, null, 2);
    await ctx.log(
      `Rule-check: ${checkOutput.stats.totalFindings} findings in ${checkOutput.stats.totalFiles} files`,
    );
    return { ok: true, content: checkResult };
  }

  await ctx.log(`Executing operation "${operation.name}" (${executor.type})`);

  const chunkState = { lastTime: 0 };
  const CHUNK_THROTTLE_MS = 2000;
  const handleChunk = async (accumulated: string) => {
    const now = Date.now();
    if (now - chunkState.lastTime >= CHUNK_THROTTLE_MS) {
      chunkState.lastTime = now;
      await ctx.log(`@@LLM_CONTENT::${node.id}::${accumulated}`);
    }
  };

  const effectiveInput = bestPracticeContent
    ? `## Standards (Best Practice)\n\n${bestPracticeContent}\n\n---\n\n${input.content}`
    : input.content;

  const opResult = { value: "" };

  if (executor.type === "script") {
    const scriptResult = await runScript(executor, input.inputPath, input.content);
    if (scriptResult.isErr()) {
      await ctx.log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: scriptResult.error };
    }
    opResult.value = scriptResult.value;
    await ctx.log(`Script output (${opResult.value.length} chars)`);
  } else if (executor.type === "agent" && executor.agentMode === "prompt") {
    const prompt = executor.prompt ?? "";
    if (!prompt.trim()) {
      await ctx.log(`WARNING: Prompt text is empty for operation "${operation.name}", skipping`);
      await ctx.log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }
    const promptResult = await runPromptAgent({
      prompt,
      inputContent: effectiveInput,
      getSettings: ctx.getSettings,
      modelOverride,
      onChunk: handleChunk,
      onProgress: ctx.log,
    });
    if (promptResult.isErr()) {
      await ctx.log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: new ScriptExecutionError(promptResult.error.message) };
    }
    opResult.value = promptResult.value;
    await ctx.log(`@@LLM_CONTENT::${node.id}::${opResult.value}`);
    await ctx.log(`Prompt output (${opResult.value.length} chars)`);
  } else if (executor.type === "agent" && executor.agentMode === "skill") {
    const skillId = executor.skillId ?? "";
    if (!skillId) {
      await ctx.log(`WARNING: No skillId configured for operation "${operation.name}", skipping`);
      await ctx.log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }

    const skill = (await skillsDao.findById(skillId)) ?? (await skillsDao.findByName(skillId));
    const skillDescription = skill
      ? `${skill.label}: ${skill.description}`
      : `Skill "${skillId}" (no description available)`;

    await ctx.log(`Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`);
    const skillResult = await runSkillAgent({
      skillId,
      skillDescription,
      inputContent: effectiveInput,
      inputPath: input.inputPath,
      getSettings: ctx.getSettings,
      modelOverride,
      onChunk: handleChunk,
      onProgress: ctx.log,
      writeEnabled: executor.writeEnabled === true,
    });
    opResult.value = skillResult.isOk() ? skillResult.value : "";
    await ctx.log(`@@LLM_CONTENT::${node.id}::${opResult.value}`);
    await ctx.log(`Skill output (${opResult.value.length} chars)`);
  }

  return { ok: true, content: opResult.value };
};
