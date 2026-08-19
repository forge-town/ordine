import { agentEngine } from "@repo/agent-engine";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";
import type { LoopEvaluationOptions } from "@repo/pipeline-engine";
import type { SshConnection } from "@repo/schemas";

type LoopEvaluatorOptions = LoopEvaluationOptions & { ssh?: SshConnection };

export type LoopEvaluatorFn = (opts: LoopEvaluatorOptions) => Promise<boolean>;

export class LoopEvaluatorRuntimeNotFoundError extends Error {
  constructor() {
    super("Loop evaluator runtime was not resolved");
    this.name = "LoopEvaluatorRuntimeNotFoundError";
  }
}

const SYSTEM_PROMPT = `You are a strict evaluator. Given acceptance criteria and operation output, determine if the output meets the criteria.
Respond with EXACTLY one word: "PASS" if the criteria are met, or "FAIL" if not. Do not explain.`;

export const loopEvaluator = {
  create: ({ apiKey }: { apiKey?: string } = {}) => {
    return ({ jobId }: { jobId: string }): LoopEvaluatorFn => {
      return async ({
        conditionPrompt,
        operationOutput,
        agent,
        model,
        ssh,
      }: LoopEvaluatorOptions): Promise<boolean> => {
        if (!agent) throw new LoopEvaluatorRuntimeNotFoundError();

        const userPrompt = `## Acceptance Criteria\n${conditionPrompt}\n\n## Operation Output\n${operationOutput}`;

        await trace(
          jobId,
          `[Loop] Evaluating condition with runtime "${agent}"${model ? ` and model "${model}"` : ""}`,
        );

        const result = await agentEngine.run({
          agent,
          mode: "direct",
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          cwd: process.cwd(),
          allowedTools: [],
          apiKey,
          model,
          ssh,
        });

        const verdict = result.text.trim().toUpperCase();
        logger.info({ jobId, verdict, agent, model }, "loopEvaluator: evaluation complete");
        await trace(jobId, `[Loop] Condition evaluation result: ${verdict}`);

        return verdict.startsWith("PASS");
      };
    };
  },
};
