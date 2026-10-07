import { ResultAsync } from "neverthrow";
import { READ_ONLY_TOOLS, ToolNameSchema } from "@repo/agent";
import { logger } from "@repo/logger";

import { runAgent } from "../../helpers/agentRunner/agentRunner.helper";
import type { RunSkillExecutorOptions, SkillExecutorAssemblyBindings } from "../../contracts";
import type { SkillExecutionError } from "../../helpers/skillExecutor";

export const createSkillExecutorRunMethod =
  (
    serviceBindings: Pick<
      SkillExecutorAssemblyBindings,
      | "DEFAULT_SKILL_SYSTEM_PROMPT"
      | "buildSkillUserPrompt"
      | "SkillExecutionError"
      | "validateSkillOutput"
    >,
  ) =>
  ({
    jobId,
    skillId,
    skillDescription,
    systemPrompt,
    inputContent,
    inputPath,
    agent = "mastra",
    onChunk,
    onProgress,
    allowedTools: customAllowedTools,
    apiKey,
    model,
    reasoningEffort,
    speed,
    firstOutputTimeoutMs,
    runtimeConfigId,
    executablePath,
    ssh,
    outputItems,
    outputDir,
    runtimeContext,
    getMcpConnectorInjection,
    signal,
    onRuntimeEvent,
    onAgentRunStarted,
    agentRunController,
  }: RunSkillExecutorOptions): ResultAsync<string, SkillExecutionError> => {
    const effectiveSystemPrompt = systemPrompt ?? serviceBindings.DEFAULT_SKILL_SYSTEM_PROMPT;
    const userPrompt = (0, serviceBindings.buildSkillUserPrompt)({
      skillId,
      skillDescription,
      inputContent,
      inputPath,
      outputItems,
      outputDir,
      runtimeContext,
    });

    const connectorTools =
      customAllowedTools?.filter((toolName) => toolName.startsWith("mcp__")) ?? [];
    const builtInTools = customAllowedTools?.filter((toolName) => !toolName.startsWith("mcp__"));
    const parsedCustomTools = builtInTools
      ? ToolNameSchema.array().readonly().safeParse(builtInTools)
      : null;
    const allowedTools =
      (parsedCustomTools?.success ? [...parsedCustomTools.data, ...connectorTools] : null) ??
      READ_ONLY_TOOLS;

    return ResultAsync.fromPromise(
      (async () => {
        await onProgress?.("runSkill: start");
        const streamState = { accumulated: "" };

        const raw = await runAgent({
          agent,
          systemPrompt: effectiveSystemPrompt,
          userPrompt,
          inputPath,
          jobId,
          agentId: skillId,
          allowedTools,
          onProgress,
          onTextDelta: onChunk
            ? async (text) => {
                streamState.accumulated += text;
                await onChunk(streamState.accumulated);
              }
            : undefined,
          logPrefix: "runSkill",
          apiKey,
          model,
          reasoningEffort,
          speed,
          firstOutputTimeoutMs,
          runtimeConfigId,
          executablePath,
          ssh,
          getMcpConnectorInjection,
          signal,
          onRuntimeEvent,
          onAgentRunStarted,
          agentRunController,
        });

        if (raw.length === 0) {
          logger.warn({ agent }, "runSkill: agent returned empty output");
          await onProgress?.(`runSkill: WARNING — ${agent} returned empty output`);

          throw new serviceBindings.SkillExecutionError(
            `${agent} agent returned empty output for skill "${skillId}"`,
          );
        }

        const result = (0, serviceBindings.validateSkillOutput)({ raw });
        if (onChunk) await onChunk(result);

        return result;
      })(),
      (cause) =>
        cause instanceof serviceBindings.SkillExecutionError
          ? cause
          : new serviceBindings.SkillExecutionError(
              `Skill execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
              cause,
            ),
    );
  };
