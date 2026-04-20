import { streamText } from "ai";
import { trace } from "@repo/obs";
import type { createLlmService } from "../../llmService";

export type LoopEvaluatorFn = (
  conditionPrompt: string,
  operationOutput: string,
  modelOverride?: string,
) => Promise<boolean>;

export const createLoopEvaluator = (getModel: ReturnType<typeof createLlmService>["getModel"]) => {
  return (jobId: string): LoopEvaluatorFn => {
    return async (
      conditionPrompt: string,
      operationOutput: string,
      modelOverride?: string,
    ): Promise<boolean> => {
      const model = await getModel(modelOverride);
      if (!model) {
        await trace(
          jobId,
          `[Loop] No LLM configured — treating condition as FAIL (cannot evaluate)`,
        );

        return false;
      }
      const evalPrompt = `You are a strict evaluator. Given the following acceptance criteria and the operation output, determine if the output meets the criteria.

## Acceptance Criteria
${conditionPrompt}

## Operation Output
${operationOutput}

Respond with EXACTLY one word: "PASS" if the criteria are met, or "FAIL" if not. Do not explain.`;

      const result = streamText({ model, prompt: evalPrompt });
      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
      }
      const verdict = chunks.join("").trim().toUpperCase();
      await trace(jobId, `[Loop] Condition evaluation result: ${verdict}`);

      return verdict.startsWith("PASS");
    };
  };
};
