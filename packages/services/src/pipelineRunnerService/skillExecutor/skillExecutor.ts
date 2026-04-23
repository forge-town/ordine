import { ResultAsync } from "neverthrow";
import {
  READ_ONLY_TOOLS,
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

export const DEFAULT_SKILL_SYSTEM_PROMPT = [
  "You are a precise execution agent working inside a software project.",
  "Follow the provided task exactly, use available tools deliberately, and prefer concrete evidence over assumptions.",
  "Keep the final answer in the exact format requested by the task.",
].join("\n");

const buildSkillUserPrompt = ({
  skillId,
  skillDescription,
  inputContent,
  inputPath,
}: {
  skillId: string;
  skillDescription: string;
  inputContent: string;
  inputPath: string;
}): string => {
  return [
    `Skill ID: ${skillId}`,
    `Skill description: ${skillDescription}`,
    "",
    "Execute the skill description against the provided project input.",
    "Inspect the actual project files before making conclusions.",
    "",
    "Output ONLY a JSON object.",
    "Use the check structure when reporting findings:",
    JSON.stringify(CHECK_OUTPUT_EXAMPLE, null, 2),
    "",
    "Use the fix structure when reporting applied changes:",
    JSON.stringify(FIX_OUTPUT_EXAMPLE, null, 2),
    "",
    inputPath ? `Project path: ${inputPath}` : "",
    "",
    "Input:",
    inputContent,
  ]
    .filter((line) => line !== "")
    .join("\n");
};

const validateSkillOutput = ({ raw }: { raw: string }): string => {
  const json = extractJsonFromText(raw);
  const parsedJson = JSON.parse(json);
  const checkParsed = CheckOutputSchema.safeParse(parsedJson);
  if (checkParsed.success) {
    logger.info({ len: json.length }, "runSkill: valid report");

    return json;
  }
  const fixParsed = FixOutputSchema.safeParse(parsedJson);
  if (fixParsed.success) {
    logger.info({ len: json.length }, "runSkill: valid report");

    return json;
  }
  logger.warn(
    { checkErrors: checkParsed.error, fixErrors: fixParsed.error },
    "runSkill: schema validation failed, using raw",
  );

  return json;
};

const run = ({
  jobId,
  skillId,
  skillDescription,
  systemPrompt,
  inputContent,
  inputPath,
  agent = "claude-code",
  onChunk,
  onProgress,
  allowedTools: customAllowedTools,
}: RunSkillExecutorOptions): ResultAsync<string, SkillExecutionError> => {
  const effectiveSystemPrompt = systemPrompt ?? DEFAULT_SKILL_SYSTEM_PROMPT;
  const userPrompt = buildSkillUserPrompt({
    skillId,
    skillDescription,
    inputContent,
    inputPath,
  });

  const parsedCustomTools = customAllowedTools
    ? ToolNameSchema.array().readonly().safeParse(customAllowedTools)
    : null;
  const allowedTools = (parsedCustomTools?.success ? parsedCustomTools.data : null) ?? READ_ONLY_TOOLS;

  return ResultAsync.fromPromise(
    (async () => {
      await onProgress?.("runSkill: start");

      const raw = await runAgent({
        agent,
        systemPrompt: effectiveSystemPrompt,
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

      const result = validateSkillOutput({ raw });
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
