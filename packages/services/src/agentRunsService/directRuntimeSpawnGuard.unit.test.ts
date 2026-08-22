import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BUSINESS_CALLERS = [
  "../skillsService/createSkillsService.ts",
  "../distillationsService/runDistillation.ts",
  "../pipelineAgentSessionsService/createPipelineAgentSessionsService.ts",
  "../pipelineRunnerService/loopEvaluator/loopEvaluator.ts",
  "../pipelineRunnerService/skillExecutor/skillExecutor.ts",
  "../pipelineRunnerService/promptExecutor/promptExecutor.ts",
  "../pipelineRunnerService/agentRunner/agentRunner.ts",
  "../pipelineRunnerService/agentRunner/runStructuredAgent.ts",
];

describe("formal runtime spawn boundary", () => {
  it("keeps Codex, Claude Code, and OpenCode adapters behind Agent Engine control", () => {
    for (const relativePath of BUSINESS_CALLERS) {
      const source = readFileSync(join(import.meta.dirname, relativePath), "utf8");
      expect(source, relativePath).not.toMatch(/\b(?:runClaude|runCodex|runOpencode)\s*\(/);
      expect(source, relativePath).not.toMatch(/from\s+["']node:child_process["']/);
      expect(source, relativePath).not.toMatch(/agentEngine\.runDirect\s*\(/);
    }
  });
});
