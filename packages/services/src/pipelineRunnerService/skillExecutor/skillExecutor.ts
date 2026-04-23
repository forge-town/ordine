import { ResultAsync } from "neverthrow";
import {
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  extractJsonFromText,
  CheckOutputSchema,
  FixOutputSchema,
  ToolNameSchema,
  type CheckOutput,
  type FixOutput,
} from "@repo/agent";
import { logger } from "@repo/logger";
import type { RunSkillOptions as EngineRunSkillOptions } from "@repo/pipeline-engine";
import { runAgent } from "../agentRunner/agentRunner";

const CHECK_OUTPUT_EXAMPLE: CheckOutput = {
  type: "check" as const,
  summary: "Executive summary of the check results",
  findings: [
    {
      id: "FINDING_001",
      severity: "error" as const,
      message: "One-line description of the issue",
      file: "relative/path/to/file.ts",
      line: 42,
      rule: "rule-name",
      snippet: "short code snippet showing the violation",
      suggestion: "how to fix the issue",
      skipped: false,
      skipReason: "reason if skipped (only when skipped=true)",
    },
  ],
  stats: {
    totalFiles: 10,
    totalFindings: 5,
    errors: 2,
    warnings: 2,
    infos: 1,
    skipped: 1,
  },
};

const FIX_OUTPUT_EXAMPLE: FixOutput = {
  type: "fix" as const,
  summary: "Summary of all changes made",
  changes: [
    {
      file: "relative/path/to/file.ts",
      action: "replace" as const,
      description: "What was changed",
      findingId: "FINDING_001",
    },
  ],
  remainingFindings: [
    {
      id: "FINDING_002",
      severity: "warning" as const,
      message: "Issue that could not be auto-fixed",
      file: "relative/path/to/other.ts",
    },
  ],
  stats: {
    totalChanges: 3,
    filesModified: 2,
    findingsFixed: 3,
    findingsSkipped: 1,
  },
};

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

  const systemPrompt = buildSkillSystemPrompt({
    skillId,
    skillDescription,
    mode,
    promptMode,
  });

  const parsedCustomTools = customAllowedTools
    ? ToolNameSchema.array().readonly().safeParse(customAllowedTools)
    : null;
  const allowedTools =
    (parsedCustomTools?.success ? parsedCustomTools.data : null) ??
    (isImplementMode ? WRITE_TOOLS : READ_ONLY_TOOLS);

  return ResultAsync.fromPromise(
    (async () => {
      await onProgress?.(`runSkill: mode=${mode}`);

      const raw = await runAgent({
        agent,
        systemPrompt,
        userPrompt,
        inputPath,
        jobId,
        agentId: skillId,
        allowedTools,
        onProgress,
        logPrefix: "runSkill",
      });

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
