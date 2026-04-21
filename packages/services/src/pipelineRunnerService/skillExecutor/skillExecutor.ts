import { streamText } from "ai";
import { ResultAsync, Result } from "neverthrow";
import { dirname } from "node:path";
import { statSync } from "node:fs";
import {
  getModel,
  runClaudeTmux,
  runCodexTmux,
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
import type { RunSkillOptions as EngineRunSkillOptions } from "@repo/pipeline-engine";
import { structuredOutput } from "../structuredOutput";

export class SkillExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SkillExecutionError";
  }
}

type RunSkillExecutorOptions = EngineRunSkillOptions & {
  getSettings: SettingsResolver;
  jobId?: string;
  onTmuxSession?: (sessionName: string) => Promise<void>;
};

const buildSkillSystemPrompt = ({
  skillId,
  skillDescription,
  mode,
  promptMode = "code",
}: {
  skillId: string;
  skillDescription: string;
  mode: "check" | "fix";
  promptMode?: "code" | "research";
}): string => {
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

const validateSkillOutput = ({ raw, mode }: { raw: string; mode: "check" | "fix" }): string => {
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

/**
 * Resolve inputPath to a valid cwd directory.
 * If it's a file path, use its parent directory.
 */
const resolveCwd = ({ inputPath }: { inputPath: string | undefined }): string => {
  if (!inputPath) return process.cwd();
  const result = Result.fromThrowable(
    () => statSync(inputPath),
    () => undefined,
  )();

  if (result.isOk() && !result.value.isDirectory()) {
    return dirname(inputPath);
  }

  return inputPath;
};

const run = ({
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
  onTmuxSession,
  writeEnabled,
  allowedTools: customAllowedTools,
  promptMode = "code",
}: RunSkillExecutorOptions): ResultAsync<string, SkillExecutionError> => {
  const isImplementMode = writeEnabled === true;
  const mode = isImplementMode ? "fix" : "check";
  const isResearch = promptMode === "research";

  const userPrompt =
    inputPath && !isResearch
      ? `Project path: ${inputPath}\n\nInput:\n${inputContent}`
      : `Input:\n${inputContent}`;

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

      const systemPrompt = buildSkillSystemPrompt({
        skillId,
        skillDescription,
        mode,
        promptMode,
      });

      if (agent === "local-claude") {
        const cwd = resolveCwd({ inputPath });
        const parsedCustomTools = customAllowedTools
          ? ToolNameSchema.array().readonly().safeParse(customAllowedTools)
          : null;
        const allowedTools =
          (parsedCustomTools?.success ? parsedCustomTools.data : null) ??
          (isImplementMode ? WRITE_TOOLS : READ_ONLY_TOOLS);
        const claudeStartTime = Date.now();

        const claudeResult = await ResultAsync.fromPromise(
          runClaudeTmux({
            systemPrompt,
            userPrompt,
            cwd,
            allowedTools,
            onProgress,
            onSessionCreated: onTmuxSession,
          }),
          (error) => error,
        );

        if (claudeResult.isErr()) {
          const error = claudeResult.error;
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error({ err: errMsg }, "runSkill: claude -p failed");
          await onProgress?.(`runSkill: Claude FAILED — ${errMsg}`);

          throw new SkillExecutionError(
            `Claude agent failed for skill "${skillId}": ${errMsg}`,
            error,
          );
        }

        const raw = claudeResult.value.text;
        const events = claudeResult.value.events;
        logger.info({ len: raw.length, events: events.length }, "runSkill: claude complete");
        await onProgress?.(
          `runSkill: Claude complete, output=${raw.length} chars, ${events.length} events`,
        );

        if (raw.length === 0) {
          logger.warn("runSkill: claude returned empty output");
          await onProgress?.("runSkill: WARNING — Claude returned empty output");

          throw new SkillExecutionError(
            `Claude agent returned empty output for skill "${skillId}"`,
          );
        }

        const result = isResearch ? raw : validateSkillOutput({ raw, mode });
        if (onChunk) await onChunk(result);

        // Record observability for local-claude
        if (jobId) {
          const claudeDurationMs = Date.now() - claudeStartTime;
          const resultEvent = events.find((e) => e.type === "result");
          const totalCost = resultEvent?.total_cost_usd ?? null;
          const modelUsage = resultEvent?.modelUsage;
          const tokenTotals = Object.values(modelUsage ?? {}).reduce(
            (totals, usageEntry) => ({
              input: totals.input + (usageEntry.inputTokens ?? 0),
              output: totals.output + (usageEntry.outputTokens ?? 0),
            }),
            { input: 0, output: 0 },
          );

          const obsResult = await ResultAsync.fromPromise(
            recordAgentRunWithSpans(
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
                tokenInput: tokenTotals.input || null,
                tokenOutput: tokenTotals.output || null,
                durationMs: claudeDurationMs,
                status: "completed",
              },
              (rawExportId) =>
                buildSpansFromClaudeEvents({
                  events,
                  jobId: jobId!,
                  rawExportId,
                  skillId,
                  startTime: claudeStartTime,
                }),
            ),
            (e) => e,
          );
          if (obsResult.isErr()) {
            logger.warn(
              { err: obsResult.error },
              "runSkill: failed to record claude observability",
            );
          }
        }

        return result;
      }

      if (agent === "codex") {
        const cwd = resolveCwd({ inputPath });
        logger.info("runSkill: starting codex exec");
        await onProgress?.("[Codex] runSkill: Starting codex exec...");
        const codexStartTime = Date.now();

        const codexResult = await ResultAsync.fromPromise(
          runCodexTmux({
            systemPrompt,
            userPrompt,
            cwd,
            onProgress,
            onSessionCreated: onTmuxSession,
          }),
          (error) => error,
        );

        if (codexResult.isErr()) {
          const error = codexResult.error;
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error({ err: errMsg }, "runSkill: codex exec failed");
          await onProgress?.(`runSkill: Codex FAILED — ${errMsg}`);

          throw new SkillExecutionError(
            `Codex agent failed for skill "${skillId}": ${errMsg}`,
            error,
          );
        }

        const raw = codexResult.value.output;
        logger.info({ len: raw.length }, "runSkill: codex complete");
        await onProgress?.(`runSkill: Codex complete, output=${raw.length} chars`);

        if (raw.length === 0) {
          logger.warn("runSkill: codex returned empty output");
          await onProgress?.("runSkill: WARNING — Codex returned empty output");

          throw new SkillExecutionError(`Codex agent returned empty output for skill "${skillId}"`);
        }

        const codexParsed = isResearch ? raw : validateSkillOutput({ raw, mode });
        if (onChunk) await onChunk(codexParsed);

        if (jobId) {
          const codexDurationMs = Date.now() - codexStartTime;
          const obsResult = await ResultAsync.fromPromise(
            recordAgentRunWithSpans(
              {
                jobId,
                agentSystem: "codex",
                agentId: skillId,
                modelId: modelOverride ?? null,
                rawPayload: {
                  system: systemPrompt,
                  prompt: userPrompt,
                  output: raw,
                },
                durationMs: codexDurationMs,
                status: "completed",
              },
              (rawExportId) => [
                {
                  jobId: jobId!,
                  rawExportId,
                  spanType: "agent_run",
                  name: skillId,
                  input: userPrompt.slice(0, 10_000),
                  output: raw.slice(0, 10_000),
                  modelId: modelOverride ?? null,
                  tokenInput: null,
                  tokenOutput: null,
                  durationMs: codexDurationMs,
                  status: "completed",
                  startedAt: new Date(Date.now() - codexDurationMs),
                  finishedAt: new Date(),
                },
              ],
            ),
            (e) => e,
          );
          if (obsResult.isErr()) {
            logger.warn({ err: obsResult.error }, "runSkill: failed to record codex observability");
          }
        }

        return codexParsed;
      }

      // agent === "mastra" — use streaming LLM
      const model = await getModel(getSettings, modelOverride);
      if (!model) {
        logger.warn("runSkill: No LLM model configured");
        await onProgress?.("[Mastra] runSkill: No LLM model configured");

        throw new SkillExecutionError(`No LLM model configured for skill "${skillId}"`);
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
        const obsResult = await ResultAsync.fromPromise(
          recordAgentRunWithSpans(
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
                input: userPrompt.slice(0, 10_000),
                output: accumulated.slice(0, 10_000),
                modelId: modelOverride ?? "default",
                tokenInput: usage?.inputTokens ?? null,
                tokenOutput: usage?.outputTokens ?? null,
                durationMs: runDurationMs,
                status: "completed" as const,
                startedAt: new Date(Date.now() - runDurationMs),
                finishedAt: new Date(),
              },
            ],
          ),
          (e) => e,
        );
        if (obsResult.isErr()) {
          logger.warn({ err: obsResult.error }, "runSkill: failed to record agent observability");
        }
      }

      if (accumulated.length === 0) {
        logger.warn("runSkill: LLM returned empty output");
        await onProgress?.("[Mastra] runSkill: WARNING — LLM returned empty output");

        throw new SkillExecutionError(`LLM returned empty output for skill "${skillId}"`);
      }

      return structuredOutput.extract({ rawText: accumulated });
    })(),
    (cause) =>
      cause instanceof SkillExecutionError
        ? cause
        : new SkillExecutionError(
            `Skill execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          ),
  );
};

export const skillExecutor = {
  run,
};

/**
 * Convert Claude stream-json events into span records for observability.
 * Creates spans for: thinking, text output, tool_use, tool_result.
 */
const buildSpansFromClaudeEvents = ({
  events,
  jobId,
  rawExportId,
  skillId,
  startTime,
}: {
  events: ClaudeStreamEvent[];
  jobId: string;
  rawExportId: number;
  skillId: string;
  startTime: number;
}): RecordSpanOptions[] => {
  const spans: RecordSpanOptions[] = [];
  const baseTime = new Date(startTime);
  const spanCounter = { value: 0 };

  for (const ev of events) {
    if (ev.type === "assistant" && ev.message?.content) {
      const model = ev.message.model ?? null;
      for (const block of ev.message.content) {
        spanCounter.value += 1;
        if (block.type === "thinking" && block.thinking) {
          spans.push({
            jobId,
            rawExportId,
            spanType: "llm_call",
            name: `thinking-${spanCounter.value}`,
            input: null,
            output: block.thinking.slice(0, 10_000),
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
            name: `text-${spanCounter.value}`,
            input: null,
            output: block.text.slice(0, 10_000),
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
            name: block.name ?? `tool-${spanCounter.value}`,
            input: block.input ? JSON.stringify(block.input).slice(0, 10_000) : null,
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
          spanCounter.value += 1;
          const resultText =
            typeof block.content === "string"
              ? block.content
              : block.content == null
                ? null
                : JSON.stringify(block.content);
          spans.push({
            jobId,
            rawExportId,
            spanType: "tool_result",
            name: `result-${spanCounter.value}`,
            input: null,
            output: resultText ? resultText.slice(0, 10_000) : null,
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
