/**
 * Skill executor — runs a skill using agents from @repo/agent.
 *
 * For project paths: uses createCheckAgent or createFixAgent.
 * For non-project: falls back to streaming prompt without tools.
 */

import { streamText } from "ai";
import { ResultAsync, ok } from "neverthrow";
import {
  getLlmModel,
  getMastraModelConfig,
  createCheckAgent,
  createFixAgent,
  type LlmOverride,
  type LogFn,
  type SettingsResolver,
  noopLog,
} from "@repo/agent";
import { extractStructuredOutput } from "./output";
import type { StreamCallback } from "./prompt-executor";

export const runSkill = (
  skillId: string,
  skillDescription: string,
  inputContent: string,
  inputPath: string,
  getSettings: SettingsResolver,
  override?: LlmOverride,
  onChunk?: StreamCallback,
  log: LogFn = noopLog,
  opts?: { writeEnabled?: boolean }
): ResultAsync<string, never> => {
  const isImplementMode = opts?.writeEnabled === true;

  const userPrompt = inputPath
    ? `Project path: ${inputPath}\n\nInput:\n${inputContent}`
    : `Input:\n${inputContent}`;

  const generateFallbackReport = (): string => {
    const fallback = isImplementMode
      ? {
          type: "fix" as const,
          summary: `LLM analysis unavailable for skill "${skillId}". No changes made.`,
          changes: [],
          remainingFindings: [],
          stats: {
            totalChanges: 0,
            filesModified: 0,
            findingsFixed: 0,
            findingsSkipped: 0,
          },
        }
      : {
          type: "check" as const,
          summary: `LLM analysis unavailable for skill "${skillId}". Input forwarded as-is.`,
          findings: [],
          stats: {
            totalFiles: 0,
            totalFindings: 0,
            errors: 0,
            warnings: 0,
            infos: 0,
            skipped: 0,
          },
        };
    return JSON.stringify(fallback, null, 2);
  };

  return ResultAsync.fromPromise(
    (async () => {
      await log(
        `[Mastra] runSkill: skillId=${skillId}, input length=${inputContent.length}, inputPath=${inputPath}`
      );
      await log(`[Mastra] runSkill: mode=${isImplementMode ? "fix" : "check"}`);

      // Use Mastra Agent with tools if we have a project path
      if (inputPath) {
        const modelConfig = await getMastraModelConfig(getSettings, override, log);
        if (!modelConfig) {
          await log(`[Mastra] runSkill: No model config — returning fallback report`);
          return generateFallbackReport();
        }

        const agentOpts = {
          skillId,
          skillDescription,
          model: modelConfig,
          projectRoot: inputPath,
        };
        const agent = isImplementMode ? createFixAgent(agentOpts) : createCheckAgent(agentOpts);

        await log(`[Mastra] runSkill: Starting agent.generate (tool-use mode)...`);

        const MAX_ATTEMPTS = 2;
        const generateWithRetry = async (): Promise<Awaited<
          ReturnType<typeof agent.generate>
        > | null> => {
          for (const attempt of Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1)) {
            try {
              return await agent.generate(userPrompt, {
                maxSteps: 25,
                ...(attempt > 1
                  ? {
                      providerOptions: {
                        openai: { reasoning_effort: "none" },
                      },
                    }
                  : {}),
              });
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              const isThinkingError = errMsg.includes("reasoning_content");
              await log(
                `[Mastra] runSkill: agent.generate THREW (attempt ${attempt}/${MAX_ATTEMPTS}) — ${errMsg}`
              );

              if (isThinkingError && attempt < MAX_ATTEMPTS) {
                await log(`[Mastra] runSkill: Retrying with reasoning disabled...`);
                continue;
              }

              return null;
            }
          }
          return null;
        };

        const result = await generateWithRetry();
        if (!result) return generateFallbackReport();

        const stepCount = result.steps?.length ?? 0;
        const toolCallCount = (result.steps ?? []).reduce(
          (acc, step) => acc + (step.toolCalls?.length ?? 0),
          0
        );

        // If result.text is empty, try to salvage text from intermediate steps
        const outputText = (() => {
          if (result.text) return result.text;
          if (result.steps?.length) {
            const stepTexts = result.steps.map((s) => s.text ?? "").filter((t) => t.length > 50);
            if (stepTexts.length > 0) return stepTexts.at(-1) ?? "";
          }
          return "";
        })();
        if (!result.text && outputText) {
          await log(`[Mastra] runSkill: Salvaged ${outputText.length} chars from step text`);
        }

        await log(
          `[Mastra] runSkill: Agent complete, steps=${stepCount}, tool calls=${toolCallCount}, output=${outputText.length} chars`
        );

        if (onChunk) await onChunk(outputText);

        if (outputText.length === 0) {
          await log(
            `[Mastra] runSkill: WARNING — Agent returned empty output, using fallback report`
          );
          return generateFallbackReport();
        }
        return extractStructuredOutput(outputText, log);
      }

      // Fallback to streaming without tools if no project path
      const model = await getLlmModel(getSettings, override, log);
      if (!model) {
        await log(`[Mastra] runSkill: No LLM model — returning fallback report`);
        return generateFallbackReport();
      }
      const systemPrompt = `You are an expert code analysis agent executing the skill "${skillId}". Skill description: ${skillDescription}`;
      await log(`[Mastra] runSkill: Starting streamText (no project path)...`);
      const result = streamText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
      });
      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
        if (onChunk) await onChunk(chunks.join(""));
      }
      const accumulated = chunks.join("");
      await log(
        `[Mastra] runSkill: Stream complete, chunks=${chunks.length}, total output=${accumulated.length} chars`
      );
      if (accumulated.length === 0) {
        await log(`[Mastra] runSkill: WARNING — LLM returned empty output, using fallback report`);
        return generateFallbackReport();
      }
      return extractStructuredOutput(accumulated, log);
    })(),
    (cause) => cause
  ).orElse((cause) => {
    const errMsg = cause instanceof Error ? cause.message : String(cause);
    void log(`[Mastra] runSkill: Agent call FAILED — ${errMsg}`);
    return ok(generateFallbackReport());
  });
};
