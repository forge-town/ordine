import { Agent } from "@mastra/core/agent";
import { logger } from "@repo/logger";

export interface RunMastraOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

export const runMastra = async ({
  systemPrompt,
  userPrompt,
  cwd,
  model = "deepseek/deepseek-chat",
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunMastraOptions): Promise<{ text: string; events: [] }> => {
  logger.info({ cwd, model }, "runMastra: starting");
  await onProgress?.(`[Mastra] Starting agent (cwd=${cwd}, model=${model})...`);

  const agent = new Agent({
    id: "ordine-mastra-agent",
    name: "Ordine Mastra Agent",
    instructions: systemPrompt,
    model,
  });

  const startTime = Date.now();

  const result = await Promise.race([
    agent.generate(userPrompt),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`mastra timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    }),
  ]);

  const durationMs = Date.now() - startTime;
  logger.info(
    { len: result.text.length, durationMs },
    "runMastra: complete",
  );
  await onProgress?.(
    `[Mastra] Complete (${result.text.length} chars, ${durationMs}ms)`,
  );

  return { text: result.text, events: [] };
};
