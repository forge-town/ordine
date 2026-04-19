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
  runCodex,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  extractJsonFromText,
  CHECK_OUTPUT_EXAMPLE,
  FIX_OUTPUT_EXAMPLE,
  CheckOutputSchema,
  FixOutputSchema,
  ToolNameSchema,
  type SettingsResolver,
  type ClaudeStreamEvent,
} from "@repo/agent";
import { logger } from "@repo/logger";
import { recordAgentRunWithSpans, type RecordSpanOptions } from "@repo/obs";
import type { AgentBackend } from "@repo/pipeline-engine";
import { extractStructuredOutput } from "./structuredOutput.js";
import type { StreamCallback, ProgressCallback } from "./promptExecutor.js";

export interface RunSkillOptions {
  jobId?: string;
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
  allowedTools?: string[];
  promptMode?: "code" | "research";
}

const buildSkillSystemPrompt = (
  skillId: string,
  skillDescription: string,
  mode: "check" | "fix",
  promptMode: "code" | "research" = "code",
): string => {
  if (promptMode === "research") {
    return [
      `You are a research agent executing the task "${skillId}".`,
      `Task description: ${skillDescription}`,
      "",
      "Use the tools available to you (Bash with curl, WebSearch, WebFetch, etc.) to gather information from the web.",
      "Do NOT analyze local source code files. Focus on web research.",
      "",
      "Execute the research task described above. Use curl, web search, and web fetch tools to find real data.",
      "",
      "Output your findings as a JSON object with this structure:",
      JSON.stringify(
        {
          task: skillId,
          summary: "Brief summary of what was found",
          data: [{ example: "your structured data here" }],
          stats: { totalItems: 0, sources: 0 },
        },
        null,
        2,
      ),
      "",
      "Your final message MUST be this JSON object and nothing else.",
    ].join("\n");
  }

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
  jobId,
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
  allowedTools: customAllowedTools,
  promptMode = "code",
}: RunSkillOptions): ResultAsync<string, never> => {
  const isImplementMode = writeEnabled === true;
  const mode = isImplementMode ? "fix" : "check";
  const isResearch = promptMode === "research";

  const userPrompt =
    inputPath && !isResearch
      ? `Project path: ${inputPath}\n\nInput:\n${inputContent}`
      : `Input:\n${inputContent}`;

  const generateFallbackReport = (): string => {
    if (isResearch) {
      return JSON.stringify(
        {
          task: skillId,
          summary: `Research agent unavailable for "${skillId}". Input forwarded as-is.`,
          data: [],
          stats: { totalItems: 0, sources: 0 },
        },
        null,
        2,
      );
    }
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

      const systemPrompt = buildSkillSystemPrompt(skillId, skillDescription, mode, promptMode);

      if (agent === "local-claude") {
        const cwd = inputPath || process.cwd();
        const parsedCustomTools = customAllowedTools
          ? ToolNameSchema.array().readonly().safeParse(customAllowedTools)
          : null;
        const allowedTools =
          (parsedCustomTools?.success ? parsedCustomTools.data : null) ??
          (isImplementMode ? WRITE_TOOLS : READ_ONLY_TOOLS);
        const claudeStartTime = Date.now();

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

        const raw = claudeResult.value.text;
        const events = claudeResult.value.events;
        logger.info({ len: raw.length, events: events.length }, "runSkill: claude complete");
        await onProgress?.(
          `runSkill: Claude complete, output=${raw.length} chars, ${events.length} events`,
        );

        if (raw.length === 0) {
          logger.warn("runSkill: claude returned empty output — using fallback");
          await onProgress?.("runSkill: WARNING — Claude returned empty output, using fallback");
          return generateFallbackReport();
        }

        const result = isResearch ? raw : validateSkillOutput(raw, mode);
        if (onChunk) await onChunk(result);

        // Record observability for local-claude
        if (jobId) {
          const claudeDurationMs = Date.now() - claudeStartTime;
          const resultEvent = events.find((e) => e.type === "result");
          const totalCost = resultEvent?.total_cost_usd ?? null;
          const modelUsage = resultEvent?.modelUsage;
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          if (modelUsage) {
            for (const m of Object.values(modelUsage)) {
              totalInputTokens += m.inputTokens ?? 0;
              totalOutputTokens += m.outputTokens ?? 0;
            }
          }

          await recordAgentRunWithSpans(
            {
              jobId,
              agentSystem: "local-claude",
              agentId: skillId,
              rawPayload: {
                system: systemPrompt,
                prompt: userPrompt,
                output: raw,
                events,
                totalCost,
              },
              tokenInput: totalInputTokens || null,
              tokenOutput: totalOutputTokens || null,
              durationMs: claudeDurationMs,
              status: "completed",
            },
            (rawExportId) =>
              buildSpansFromClaudeEvents(events, jobId!, rawExportId, skillId, claudeStartTime),
          ).catch((e) =>
            logger.warn({ err: e }, "runSkill: failed to record claude observability"),
          );
        }

        return result;
      }

      if (agent === "codex") {
        const cwd = inputPath || process.cwd();
        logger.info("runSkill: starting codex exec");
        await onProgress?.("[Codex] runSkill: Starting codex exec...");

        const codexResult = await ResultAsync.fromPromise(
          runCodex({
            systemPrompt,
            userPrompt,
            cwd,
            onProgress,
          }),
          (error) => error,
        );

        if (codexResult.isErr()) {
          const error = codexResult.error;
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error({ err: errMsg }, "runSkill: codex exec failed");
          await onProgress?.(`runSkill: Codex FAILED — ${errMsg}`);
          return generateFallbackReport();
        }

        const raw = codexResult.value;
        logger.info({ len: raw.length }, "runSkill: codex complete");
        await onProgress?.(`runSkill: Codex complete, output=${raw.length} chars`);

        if (raw.length === 0) {
          logger.warn("runSkill: codex returned empty output — using fallback");
          await onProgress?.("runSkill: WARNING — Codex returned empty output, using fallback");
          return generateFallbackReport();
        }

        const codexParsed = isResearch ? raw : validateSkillOutput(raw, mode);
        if (onChunk) await onChunk(codexParsed);
        return codexParsed;
      }

      // agent === "mastra" — use streaming LLM
      const model = await getModel(getSettings, modelOverride);
      if (!model) {
        logger.warn("runSkill: No LLM model — returning fallback");
        await onProgress?.("[Mastra] runSkill: No LLM model — returning fallback report");
        return generateFallbackReport();
      }
      logger.info("runSkill: starting streamText (mastra)");
      await onProgress?.("[Mastra] runSkill: Starting streamText (mastra)...");
      const mastraStartTime = Date.now();
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
      const usage = await result.usage;
      logger.info(
        { outputLen: accumulated.length, chunks: chunks.length },
        "runSkill: stream complete",
      );
      await onProgress?.(
        `[Mastra] runSkill: Stream complete, chunks=${chunks.length}, total output=${accumulated.length} chars`,
      );

      // Record observability data
      if (jobId) {
        const runDurationMs = Date.now() - mastraStartTime;
        await recordAgentRunWithSpans(
          {
            jobId,
            agentSystem: "mastra",
            agentId: skillId,
            modelId: modelOverride ?? "default",
            rawPayload: {
              system: systemPrompt,
              prompt: userPrompt,
              output: accumulated,
              usage,
            },
            tokenInput: usage?.inputTokens ?? null,
            tokenOutput: usage?.outputTokens ?? null,
            durationMs: runDurationMs,
            status: accumulated.length === 0 ? "error" : "completed",
          },
          (rawExportId) => [
            {
              jobId: jobId!,
              rawExportId,
              spanType: "agent_run" as const,
              name: skillId,
              input: userPrompt.slice(0, 10000),
              output: accumulated.slice(0, 10000),
              modelId: modelOverride ?? "default",
              tokenInput: usage?.inputTokens ?? null,
              tokenOutput: usage?.outputTokens ?? null,
              durationMs: runDurationMs,
              status: "completed" as const,
              startedAt: new Date(Date.now() - runDurationMs),
              finishedAt: new Date(),
            },
          ],
        ).catch((e) => logger.warn({ err: e }, "runSkill: failed to record agent observability"));
      }

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

/**
 * Convert Claude stream-json events into span records for observability.
 * Creates spans for: thinking, text output, tool_use, tool_result.
 */
const buildSpansFromClaudeEvents = (
  events: ClaudeStreamEvent[],
  jobId: string,
  rawExportId: number,
  skillId: string,
  startTime: number,
): RecordSpanOptions[] => {
  const spans: RecordSpanOptions[] = [];
  const baseTime = new Date(startTime);
  let spanIndex = 0;

  for (const ev of events) {
    if (ev.type === "assistant" && ev.message?.content) {
      const model = ev.message.model ?? null;
      for (const block of ev.message.content) {
        spanIndex++;
        if (block.type === "thinking" && block.thinking) {
          spans.push({
            jobId,
            rawExportId,
            spanType: "llm_call",
            name: `thinking-${spanIndex}`,
            input: null,
            output: block.thinking.slice(0, 10000),
            modelId: model,
            status: "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
          });
        } else if (block.type === "text" && block.text) {
          spans.push({
            jobId,
            rawExportId,
            spanType: "llm_call",
            name: `text-${spanIndex}`,
            input: null,
            output: block.text.slice(0, 10000),
            modelId: model,
            status: "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
          });
        } else if (block.type === "tool_use") {
          spans.push({
            jobId,
            rawExportId,
            spanType: "tool_call",
            name: block.name ?? `tool-${spanIndex}`,
            input: block.input ? JSON.stringify(block.input).slice(0, 10000) : null,
            output: null,
            modelId: model,
            status: "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
            metadata: block.id ? { toolUseId: block.id } : null,
          });
        }
      }
    }

    // user events contain tool_result blocks with execution output
    if (ev.type === "user" && ev.message?.content) {
      for (const block of ev.message.content) {
        if (block.type === "tool_result") {
          spanIndex++;
          const resultText =
            typeof block.content === "string"
              ? block.content
              : block.content != null
                ? JSON.stringify(block.content)
                : null;
          spans.push({
            jobId,
            rawExportId,
            spanType: "tool_result",
            name: `result-${spanIndex}`,
            input: null,
            output: resultText ? resultText.slice(0, 10000) : null,
            status: block.is_error ? "error" : "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
            metadata: block.tool_use_id ? { toolUseId: block.tool_use_id } : null,
          });
        }
      }
    }

    // Result event with cost/usage summary
    if (ev.type === "result") {
      spans.push({
        jobId,
        rawExportId,
        spanType: "agent_run",
        name: skillId,
        input: null,
        output: null,
        durationMs: ev.duration_ms ?? null,
        status: "completed",
        startedAt: baseTime,
        finishedAt: new Date(),
        metadata: {
          totalCost: ev.total_cost_usd,
          modelUsage: ev.modelUsage,
          numTurns: ev.num_turns,
        },
      });
    }
  }

  return spans;
};
