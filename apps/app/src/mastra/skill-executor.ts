/**
 * Skill executor — runs a skill using agents from @repo/agent.
 *
 * For project paths: uses createCheckAgent or createFixAgent.
 * For non-project: falls back to streaming prompt without tools.
 */

import { streamText } from "ai";
import { ResultAsync, ok } from "neverthrow";
import {
  getModel,
  createCheckAgent,
  createFixAgent,
  logger,
  type SettingsResolver,
} from "@repo/agent";
import { extractStructuredOutput } from "./output";
import type { StreamCallback, ProgressCallback } from "./prompt-executor";

const isRetryableError = (msg: string) =>
  msg.includes("reasoning_content") ||
  msg.includes("other side closed") ||
  msg.includes("ECONNRESET") ||
  msg.includes("ETIMEDOUT") ||
  msg.includes("fetch failed") ||
  msg.includes("Cannot connect");

export interface RunSkillOptions {
  skillId: string;
  skillDescription: string;
  inputContent: string;
  inputPath: string;
  getSettings: SettingsResolver;
  modelOverride?: string;
  onChunk?: StreamCallback;
  onProgress?: ProgressCallback;
  writeEnabled?: boolean;
}

export const runSkill = ({
  skillId,
  skillDescription,
  inputContent,
  inputPath,
  getSettings,
  modelOverride,
  onChunk,
  onProgress,
  writeEnabled,
}: RunSkillOptions): ResultAsync<string, never> => {
  const isImplementMode = writeEnabled === true;

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
      logger.info(
        {
          skillId,
          inputLen: inputContent.length,
          inputPath,
          mode: isImplementMode ? "fix" : "check",
        },
        "runSkill: starting",
      );
      await onProgress?.(
        `[Mastra] runSkill: skillId=${skillId}, input length=${inputContent.length}, inputPath=${inputPath}`,
      );
      await onProgress?.(`[Mastra] runSkill: mode=${isImplementMode ? "fix" : "check"}`);

      // Use Mastra Agent with tools if we have a project path
      if (inputPath) {
        const model = await getModel(getSettings, modelOverride);
        if (!model) {
          logger.warn("runSkill: No model — returning fallback");
          await onProgress?.("[Mastra] runSkill: No model — returning fallback report");
          return generateFallbackReport();
        }

        const agentOpts = {
          skillId,
          skillDescription,
          model,
          projectRoot: inputPath,
        };
        const { agent, reportCapture } = isImplementMode
          ? createFixAgent(agentOpts)
          : createCheckAgent(agentOpts);

        logger.info("runSkill: starting agent.generate (tool-use mode)");
        await onProgress?.("[Mastra] runSkill: Starting agent.generate (tool-use mode)...");

        const MAX_ATTEMPTS = 3;

        const generateWithRetry = async (): Promise<Awaited<
          ReturnType<typeof agent.generate>
        > | null> => {
          for (const attempt of Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1)) {
            try {
              return await agent.generate(userPrompt, { maxSteps: 40 });
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              logger.error(
                { attempt, maxAttempts: MAX_ATTEMPTS, err: errMsg },
                "runSkill: agent.generate threw",
              );
              await onProgress?.(
                `[Mastra] runSkill: agent.generate THREW (attempt ${attempt}/${MAX_ATTEMPTS}) — ${errMsg}`,
              );

              if (isRetryableError(errMsg) && attempt < MAX_ATTEMPTS) {
                logger.info("runSkill: retrying...");
                await onProgress?.("[Mastra] runSkill: Retrying...");
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
          0,
        );

        logger.info(
          { stepCount, toolCallCount, capturedReport: !!reportCapture.report },
          "runSkill: agent complete",
        );
        await onProgress?.(
          `[Mastra] runSkill: Agent complete, steps=${stepCount}, tool calls=${toolCallCount}, captured=${!!reportCapture.report}`,
        );

        // Priority 1: Use the captured report from submitReport tool
        if (reportCapture.report) {
          const captured = reportCapture.report;
          logger.info(
            { len: captured.length },
            "runSkill: using captured report from submitReport tool",
          );
          await onProgress?.(`[Mastra] runSkill: Using captured report (${captured.length} chars)`);
          if (onChunk) await onChunk(captured);
          return captured;
        }

        // Priority 2: Use result.text if available
        if (result.text && result.text.length > 20) {
          logger.info({ len: result.text.length }, "runSkill: using result.text");
          await onProgress?.(`[Mastra] runSkill: Using result.text (${result.text.length} chars)`);
          if (onChunk) await onChunk(result.text);
          return extractStructuredOutput(result.text);
        }

        // Priority 3: Try to salvage from intermediate steps
        if (result.steps?.length) {
          const stepTexts = result.steps
            .map((s) => s.text ?? "")
            .filter((t) => t.length > 20)
            .sort((a, b) => b.length - a.length);
          if (stepTexts[0]) {
            logger.info({ len: stepTexts[0].length }, "runSkill: salvaged from step text");
            await onProgress?.(
              `[Mastra] runSkill: Salvaged ${stepTexts[0].length} chars from step text`,
            );
            if (onChunk) await onChunk(stepTexts[0]);
            return extractStructuredOutput(stepTexts[0]);
          }
        }

        // Fallback
        logger.warn("runSkill: no report captured and no text output — using fallback");
        await onProgress?.("[Mastra] runSkill: WARNING — No output, using fallback report");
        return generateFallbackReport();
      }

      // Fallback to streaming without tools if no project path
      const model = await getModel(getSettings, modelOverride);
      if (!model) {
        logger.warn("runSkill: No LLM model — returning fallback");
        await onProgress?.("[Mastra] runSkill: No LLM model — returning fallback report");
        return generateFallbackReport();
      }
      const systemPrompt = `You are an expert code analysis agent executing the skill "${skillId}". Skill description: ${skillDescription}`;
      logger.info("runSkill: starting streamText (no project path)");
      await onProgress?.("[Mastra] runSkill: Starting streamText (no project path)...");
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
      logger.info(
        { outputLen: accumulated.length, chunks: chunks.length },
        "runSkill: stream complete",
      );
      await onProgress?.(
        `[Mastra] runSkill: Stream complete, chunks=${chunks.length}, total output=${accumulated.length} chars`,
      );
      if (accumulated.length === 0) {
        logger.warn("runSkill: LLM returned empty output — using fallback");
        await onProgress?.(
          "[Mastra] runSkill: WARNING — LLM returned empty output, using fallback report",
        );
        return generateFallbackReport();
      }
      return extractStructuredOutput(accumulated);
    })(),
    (cause) => cause,
  ).orElse((cause) => {
    const errMsg = cause instanceof Error ? cause.message : String(cause);
    logger.error({ err: errMsg }, "runSkill: agent call failed");
    void onProgress?.(`[Mastra] runSkill: Agent call FAILED — ${errMsg}`);
    return ok(generateFallbackReport());
  });
};
