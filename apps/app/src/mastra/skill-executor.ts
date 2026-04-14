/**
 * Skill executor — runs a skill using claude -p CLI.
 *
 * For project paths: uses claude -p with structured JSON output.
 * For non-project: falls back to streaming prompt without tools.
 */

import { streamText } from "ai";
import { ResultAsync, ok } from "neverthrow";
import { getModel, runClaude, logger, type SettingsResolver } from "@repo/agent";
import { extractStructuredOutput } from "./output";
import type { StreamCallback, ProgressCallback } from "./prompt-executor";

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
        "runSkill: starting"
      );
      await onProgress?.(
        `[Mastra] runSkill: skillId=${skillId}, input length=${inputContent.length}, inputPath=${inputPath}`
      );
      await onProgress?.(`runSkill: mode=${isImplementMode ? "fix" : "check"}`);

      // Use claude -p CLI with tools if we have a project path
      if (inputPath) {
        const claudeResult = await ResultAsync.fromPromise(
          runClaude({
            skillId,
            skillDescription,
            inputContent,
            projectRoot: inputPath,
            writeEnabled: isImplementMode,
            onProgress,
          }),
          (error) => error
        );

        if (claudeResult.isErr()) {
          const error = claudeResult.error;
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error({ err: errMsg }, "runSkill: claude -p failed");
          await onProgress?.(`runSkill: Claude FAILED — ${errMsg}`);
          return generateFallbackReport();
        }

        const result = claudeResult.value;
        logger.info({ len: result.length }, "runSkill: claude complete");
        await onProgress?.(`runSkill: Claude complete, output=${result.length} chars`);
        if (onChunk) await onChunk(result);

        if (result.length === 0) {
          logger.warn("runSkill: claude returned empty output — using fallback");
          await onProgress?.("runSkill: WARNING — Claude returned empty output, using fallback");
          return generateFallbackReport();
        }
        return result;
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
        "runSkill: stream complete"
      );
      await onProgress?.(
        `[Mastra] runSkill: Stream complete, chunks=${chunks.length}, total output=${accumulated.length} chars`
      );
      if (accumulated.length === 0) {
        logger.warn("runSkill: LLM returned empty output — using fallback");
        await onProgress?.(
          "[Mastra] runSkill: WARNING — LLM returned empty output, using fallback report"
        );
        return generateFallbackReport();
      }
      return extractStructuredOutput(accumulated);
    })(),
    (cause) => cause
  ).orElse((cause) => {
    const errMsg = cause instanceof Error ? cause.message : String(cause);
    logger.error({ err: errMsg }, "runSkill: agent call failed");
    void onProgress?.(`[Mastra] runSkill: Agent call FAILED — ${errMsg}`);
    return ok(generateFallbackReport());
  });
};
