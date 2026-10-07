import { errAsync, ResultAsync } from "neverthrow";
import { logger } from "@repo/logger";
import { UserActionRequiredError } from "@repo/pipeline-engine";

import { runAgent } from "../../helpers/agentRunner/agentRunner.helper";
import type { PromptExecutorOptions, PromptExecutorAssemblyBindings } from "../../contracts";

export const createPromptExecutorRunMethod =
  (
    serviceBindings: Pick<
      PromptExecutorAssemblyBindings,
      | "buildOutputItemsSection"
      | "buildSystemPrompt"
      | "DOWNSTREAM_DATA_CONTRACT_SECTION"
      | "USER_ACTION_SECTION"
      | "PROMPT_AGENT_ID"
      | "parseUserActionRequest"
    >,
  ) =>
  ({
    prompt,
    inputContent,
    inputPath,
    jobId,
    agent = "mastra",
    onChunk,
    onProgress,
    apiKey,
    model,
    reasoningEffort,
    speed,
    firstOutputTimeoutMs,
    runtimeConfigId,
    executablePath,
    extraTools,
    allowedTools,
    githubToken,
    ssh,
    outputItems,
    outputDir,
    runtimeContext,
    getMcpConnectorInjection,
    signal,
    onRuntimeEvent,
    onAgentRunStarted,
    agentRunController,
  }: PromptExecutorOptions): ResultAsync<string, Error> => {
    if (!prompt?.trim()) {
      return errAsync(new Error("Prompt text is empty"));
    }

    const outputSection = (0, serviceBindings.buildOutputItemsSection)(outputItems, outputDir);
    const effectiveInput = outputSection ? `${inputContent}\n${outputSection}` : inputContent;
    const effectiveAllowedTools = [...new Set([...(allowedTools ?? []), ...(extraTools ?? [])])];

    return ResultAsync.fromPromise(
      (async () => {
        const systemPrompt = `${(0, serviceBindings.buildSystemPrompt)({ prompt, runtimeContext })}\n${serviceBindings.DOWNSTREAM_DATA_CONTRACT_SECTION}\n${serviceBindings.USER_ACTION_SECTION}`;
        const streamState = { accumulated: "" };
        const raw = await runAgent({
          agent,
          systemPrompt,
          userPrompt: effectiveInput,
          inputPath,
          jobId,
          agentId: serviceBindings.PROMPT_AGENT_ID,
          allowedTools: effectiveAllowedTools,
          onProgress,
          onTextDelta: onChunk
            ? async (text) => {
                streamState.accumulated += text;
                await onChunk(streamState.accumulated);
              }
            : undefined,
          logPrefix: "[LLM] runPrompt",
          apiKey,
          model,
          reasoningEffort,
          speed,
          firstOutputTimeoutMs,
          runtimeConfigId,
          executablePath,
          githubToken,
          ssh,
          getMcpConnectorInjection,
          signal,
          onRuntimeEvent,
          onAgentRunStarted,
          agentRunController,
        });
        const userAction = (0, serviceBindings.parseUserActionRequest)(raw);
        if (userAction.isErr()) throw userAction.error;
        if (userAction.value) {
          await onProgress?.(userAction.value.line);
          throw new UserActionRequiredError(
            `Agent requires user action: ${userAction.value.payload.message}`,
          );
        }
        if (onChunk) await onChunk(raw);

        return raw;
      })(),
      (cause) => {
        logger.error({ err: cause }, "runPrompt: failed");
        void onProgress?.(
          `[LLM] runPrompt: Error — ${cause instanceof Error ? cause.message : String(cause)}`,
        );

        if (cause instanceof UserActionRequiredError) return cause;

        return new Error(
          `Prompt execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      },
    );
  };
