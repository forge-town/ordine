/**
 * Skill executor — runs a skill using the configured agent backend.
 *
 * Dispatches to local-claude (CLI) or kimi (streaming LLM) based on the
 * `agent` field. Default: "local-claude".
 */

import { streamText } from "ai";
import { ResultAsync, ok } from "neverthrow";
import {
  getModel,
  runClaude,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  extractJsonFromText,
  CHECK_OUTPUT_EXAMPLE,
  FIX_OUTPUT_EXAMPLE,
  CheckOutputSchema,
  FixOutputSchema,
  type SettingsResolver,
} from "@repo/agent";
import { logger } from "@repo/logger";
import type { AgentBackend } from "@repo/pipeline-engine";
import { extractStructuredOutput } from "./structuredOutput.js";
import type { StreamCallback, ProgressCallback } from "./promptExecutor.js";

export interface RunSkillOptions {
  skillId: string;
  skillDescription: string;
  inputContent: string;
  inputPath: string;
  getSettings: SettingsResolver;
  modelOverride?: string;
  agent?: AgentBackend;
  onChunk?: StreamCallback;
  onProgress?: ProgressCallback;
  writeEnabled?: boolean;
}

const buildSkillSystemPrompt = (
  skillId: string,
  skillDescription: string,
  mode: "check" | "fix",
): string => {
  const example = mode === "check" ? CHECK_OUTPUT_EXAMPLE : FIX_OUTPUT_EXAMPLE;
  const lines = [
    `You are an expert code analysis agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    `Mode: ${mode}`,
    "",
    "Use the tools available to you (Read, Bash, etc.) to explore the project.",
    "Examine actual source code before making conclusions.",
    "",
    mode === "check"
      ? "Your task is to CHECK the code and report findings."
      : "Your task is to FIX violations in the code and report what you changed.",
    "",
    "Output ONLY a JSON object matching this exact structure (no markdown fences, no extra text):",
    JSON.stringify(example, null, 2),
    "",
    "Your final message MUST be this JSON object and nothing else.",
  ];
  return lines.join("\n");
};

const validateSkillOutput = (raw: string, mode: "check" | "fix"): string => {
  const json = extractJsonFromText(raw);
  const schema = mode === "check" ? CheckOutputSchema : FixOutputSchema;
  const parsed = schema.safeParse(JSON.parse(json));
  if (parsed.success) {
    logger.info({ len: json.length }, "runSkill: valid report");
    return json;
  }
  logger.warn({ errors: parsed.error }, "runSkill: schema validation failed, using raw");
  return json;
};

export const runSkill = ({
  skillId,
  skillDescription,
  inputContent,
  inputPath,
  getSettings,
  modelOverride,
  agent = "local-claude",
  onChunk,
  onProgress,
  writeEnabled,
}: RunSkillOptions): ResultAsync<string, never> => {
  const isImplementMode = writeEnabled === true;
  const mode = isImplementMode ? "fix" : "check";

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
        { skillId, inputLen: inputContent.length, inputPath, mode, agent },
        "runSkill: starting",
      );
      await onProgress?.(
        `[Mastra] runSkill: skillId=${skillId}, agent=${agent}, input length=${inputContent.length}, inputPath=${inputPath}`,
      );
      await onProgress?.(`runSkill: mode=${mode}`);

      const systemPrompt = buildSkillSystemPrompt(skillId, skillDescription, mode);

      if (agent === "local-claude") {
        const cwd = inputPath || process.cwd();
        const allowedTools = isImplementMode ? WRITE_TOOLS : READ_ONLY_TOOLS;

        const claudeResult = await ResultAsync.fromPromise(
          runClaude({
            systemPrompt,
            userPrompt,
            cwd,
            allowedTools,
            onProgress,
          }),
          (error) => error,
        );

        if (claudeResult.isErr()) {
          const error = claudeResult.error;
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error({ err: errMsg }, "runSkill: claude -p failed");
          await onProgress?.(`runSkill: Claude FAILED — ${errMsg}`);
          return generateFallbackReport();
        }

        const raw = claudeResult.value;
        logger.info({ len: raw.length }, "runSkill: claude complete");
        await onProgress?.(`runSkill: Claude complete, output=${raw.length} chars`);

        if (raw.length === 0) {
          logger.warn("runSkill: claude returned empty output — using fallback");
          await onProgress?.("runSkill: WARNING — Claude returned empty output, using fallback");
          return generateFallbackReport();
        }

        const result = validateSkillOutput(raw, mode);
        if (onChunk) await onChunk(result);
        return result;
      }

      // agent === "kimi" — use streaming LLM
      const model = await getModel(getSettings, modelOverride);
      if (!model) {
        logger.warn("runSkill: No LLM model — returning fallback");
        await onProgress?.("[Mastra] runSkill: No LLM model — returning fallback report");
        return generateFallbackReport();
      }
      logger.info("runSkill: starting streamText (kimi)");
      await onProgress?.("[Mastra] runSkill: Starting streamText (kimi)...");
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
