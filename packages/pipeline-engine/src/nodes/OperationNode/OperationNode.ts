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

// 把"全局 Pipeline 上下文"与"当前 Operation 局部职责"组装成结构化运行时上下文。
// pipeline 段只有在引擎注入了 pipelineContext 时才带上（COD-40：全局/局部分离）。
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

    return { ok: false, error: null };
  }

  const data = node.data;
  const operationId = data.operationId ?? "";
  const operation = operations.get(operationId);

  if (!operation) {
    await trace(jobId, `ERROR: Operation ${operationId} not found`);
    await trace(jobId, encodeNodeFail(node.id));

    return { ok: false, error: new ScriptExecutionError(`Operation "${operationId}" not found`) };
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
    await trace(jobId, encodeNodeFail(node.id));

    return { ok: false, error: null };
  }

  await trace(jobId, `Executing operation "${operation.name}" (${executor.type})`);

  const effectiveAgentMode =
    executor.agentMode ?? (executor.type === "agent" ? "prompt" : undefined);

  // lastContent：记录最近一次已 emit 的 LLM_CONTENT，供终态去重（RUN-03）。
  // 流式最后一帧的 accumulated 往往等于最终全文，若终态再 emit 一次会重复落 trace。
  const chunkState = { lastContent: "", lastTime: 0 };
  const handleChunk = async (accumulated: string) => {
    const now = Date.now();
    if (now - chunkState.lastTime >= CHUNK_THROTTLE_MS) {
      chunkState.lastTime = now;
      chunkState.lastContent = accumulated;
      await trace(jobId, encodeLlmContent(node.id, accumulated));
    }
  };

  // 终态 emit：仅当与最近一次流式 emit 的内容不同才发，避免 RUN-03 的相邻重复。
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
      await trace(jobId, encodeNodeFail(node.id));

      return { ok: false, error: null };
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

      return { ok: false, error: new ScriptExecutionError(promptResult.error.message) };
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

      return { ok: false, error: null };
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

      return { ok: false, error: new ScriptExecutionError(message) };
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

      return { ok: false, error: new ScriptExecutionError(skillResult.error.message) };
    }
    await traceFinalLlmContent(opResult.value);
    await trace(jobId, `Skill output (${opResult.value.length} chars)`);
  } else if (executor.type === "publish") {
    if (!executor.publishTarget || !executor.repo) {
      await trace(jobId, encodeNodeFail(node.id));

      return {
        ok: false,
        error: new ScriptExecutionError("Publish executor requires publishTarget + repo"),
      };
    }
    if (!ctx.outputDir) {
      await trace(jobId, encodeNodeFail(node.id));

      return {
        ok: false,
        error: new ScriptExecutionError("Publish has no source directory (no outputDir resolved)"),
      };
    }
    await trace(jobId, `Publishing ${ctx.outputDir} → ${executor.publishTarget}:${executor.repo}`);
    const publishResult = await deps.publishArtifact({
      sourceDir: ctx.outputDir,
      target: executor.publishTarget,
      repo: executor.repo,
      branch: executor.branch,
      subPath: executor.subPath,
      commitMessage: executor.commitMessage,
      openPr: executor.openPr,
      githubToken: ctx.githubToken,
      jobId,
      onProgress,
    });
    if (publishResult.isErr()) {
      await trace(jobId, encodeNodeFail(node.id));

      return { ok: false, error: new ScriptExecutionError(publishResult.error.message) };
    }
    opResult.value = publishResult.value;
    await trace(jobId, `Publish done: ${opResult.value}`);
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
  // N23-07 修正：记录执行起点 + 成功标记。捕获只在真正成功时进行，且只收本次执行窗口内
  // 写出的文件（mtime ≥ startedAt），避免共享 outputDir 里他节点/上轮残留被误算成本节点产物。
  const exec = { startedAt: Date.now(), succeeded: false };

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
    if (nodeResult.ok) {
      resultState.content = nodeResult.content;
      exec.succeeded = true;
      if (!resultState.content) {
        await trace(jobId, `WARNING: Operation returned empty output — using parent input`);
        resultState.content = input.content;
      }
    } else if (nodeResult.error) {
      return { ok: false, error: nodeResult.error };
    }
  }

  nodeOutputs.set(node.id, { inputPath: input.inputPath, content: resultState.content });

  // 仅在真正成功时捕获本次执行窗口写出的文件（exec.succeeded 排除软跳过的 fall-through；
  // startedAt 排除共享 outputDir 里的他节点/上轮残留）。空输出回落父输入仍捕获 file-only 运行。
  const artifact = exec.succeeded
    ? await captureOutputArtifact(ctx.outputDir, node.data.label, exec.startedAt)
    : null;
  if (artifact) {
    await trace(jobId, encodeNodeArtifact(node.id, artifact));
  }

  await trace(jobId, encodeNodeDone(node.id));

  return { ok: true };
};
