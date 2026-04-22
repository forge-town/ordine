import { agentEngine } from "@repo/agent-engine";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";
import type { AgentRuntime } from "@repo/schemas";

export type LoopEvaluatorFn = (
  conditionPrompt: string,
  operationOutput: string,
) => Promise<boolean>;

const SYSTEM_PROMPT = `You are a strict evaluator. Given acceptance criteria and operation output, determine if the output meets the criteria.
Respond with EXACTLY one word: "PASS" if the criteria are met, or "FAIL" if not. Do not explain.`;

export const loopEvaluator = {
  create: ({ agent = "claude-code" }: { agent?: AgentRuntime } = {}) => {
    return ({ jobId }: { jobId: string }): LoopEvaluatorFn => {
      return async (conditionPrompt: string, operationOutput: string): Promise<boolean> => {
        const userPrompt = `## Acceptance Criteria\n${conditionPrompt}\n\n## Operation Output\n${operationOutput}`;

        const result = await agentEngine.run({
          agent,
          mode: "direct",
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          cwd: process.cwd(),
          allowedTools: [],
        });

        const verdict = result.text.trim().toUpperCase();
        logger.info({ jobId, verdict }, "loopEvaluator: evaluation complete");
        await trace(jobId, `[Loop] Condition evaluation result: ${verdict}`);

        return verdict.startsWith("PASS");
      };
    };
  },
};
