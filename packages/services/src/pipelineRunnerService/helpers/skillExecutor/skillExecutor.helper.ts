import type { CheckOutput, FixOutput } from "@repo/agent";

export class SkillExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SkillExecutionError";
  }
}

export const DEFAULT_SKILL_SYSTEM_PROMPT = [
  "You are a precise execution agent working inside a software project.",
  "Follow the provided task exactly, use available tools deliberately, and prefer concrete evidence over assumptions.",
  "Keep the final answer in the exact format requested by the task.",
].join("\n");
import type { SkillExecutorAssemblyBindings } from "../../contracts";

import { createSkillExecutorBuildSkillUserPromptHelper } from "../skillExecutorBuildSkillUserPrompt";
import { createSkillExecutorValidateSkillOutputHelper } from "../skillExecutorValidateSkillOutput";

import { createSkillExecutorRunMethod } from "../../methods/skillExecutorRun";
const createSkillExecutorAssembly = () => {
  const serviceBindings: SkillExecutorAssemblyBindings = {
    get SkillExecutionError() {
      return SkillExecutionError;
    },
    get DEFAULT_SKILL_SYSTEM_PROMPT() {
      return DEFAULT_SKILL_SYSTEM_PROMPT;
    },
    get CHECK_OUTPUT_EXAMPLE() {
      return CHECK_OUTPUT_EXAMPLE;
    },
    get FIX_OUTPUT_EXAMPLE() {
      return FIX_OUTPUT_EXAMPLE;
    },
    get buildSkillUserPrompt() {
      return buildSkillUserPrompt;
    },
    get validateSkillOutput() {
      return validateSkillOutput;
    },
    get run() {
      return run;
    },
  };

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

  const buildSkillUserPrompt = createSkillExecutorBuildSkillUserPromptHelper(serviceBindings);

  const validateSkillOutput = createSkillExecutorValidateSkillOutputHelper(serviceBindings);

  const run = createSkillExecutorRunMethod(serviceBindings);

  return {
    run,
  };
};

export const skillExecutor = createSkillExecutorAssembly();
