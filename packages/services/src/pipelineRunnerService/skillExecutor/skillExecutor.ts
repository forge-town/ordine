import { ResultAsync } from "neverthrow";
import {
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  extractJsonFromText,
  CHECK_OUTPUT_EXAMPLE,
  FIX_OUTPUT_EXAMPLE,
  CheckOutputSchema,
  FixOutputSchema,
  ToolNameSchema,
} from "@repo/agent";
import { agentEngine } from "@repo/agent-engine";
import { logger } from "@repo/logger";
import type { RunSkillOptions as EngineRunSkillOptions } from "@repo/pipeline-engine";
import { resolveCwd } from "../resolveCwd";

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
  jobId?: string;
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

const run = ({
  jobId,
  skillId,
  skillDescription,
  inputContent,
  inputPath,
  agent = "claude-code",
  onChunk,
  onProgress,
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
        `runSkill: skillId=${skillId}, agent=${agent}, input length=${inputContent.length}, inputPath=${inputPath}`,
      );
      await onProgress?.(`runSkill: mode=${mode}`);

      const systemPrompt = buildSkillSystemPrompt({
        skillId,
        skillDescription,
        mode,
        promptMode,
      });

      const cwd = resolveCwd({ inputPath });
      const parsedCustomTools = customAllowedTools
        ? ToolNameSchema.array().readonly().safeParse(customAllowedTools)
        : null;
      const allowedTools =
        (parsedCustomTools?.success ? parsedCustomTools.data : null) ??
        (isImplementMode ? WRITE_TOOLS : READ_ONLY_TOOLS);

      const engineResult = await ResultAsync.fromPromise(
        agentEngine.run({
          agent,
          mode: "direct",
          systemPrompt,
          userPrompt,
          cwd,
          allowedTools,
          onProgress,
          jobId,
          agentId: skillId,
        }),
        (error) => error,
      );

      if (engineResult.isErr()) {
        const error = engineResult.error;
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error({ err: errMsg, agent }, "runSkill: agent failed");
        await onProgress?.(`runSkill: ${agent} FAILED — ${errMsg}`);

        throw new SkillExecutionError(
          `${agent} agent failed for skill "${skillId}": ${errMsg}`,
          error,
        );
      }

      const { text: raw } = engineResult.value;
      logger.info({ len: raw.length, agent }, "runSkill: agent complete");
      await onProgress?.(
        `runSkill: ${agent} complete, output=${raw.length} chars`,
      );

      if (raw.length === 0) {
        logger.warn({ agent }, "runSkill: agent returned empty output");
        await onProgress?.(`runSkill: WARNING — ${agent} returned empty output`);

        throw new SkillExecutionError(
          `${agent} agent returned empty output for skill "${skillId}"`,
        );
      }

      const result = isResearch ? raw : validateSkillOutput({ raw, mode });
      if (onChunk) await onChunk(result);

      return result;
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
