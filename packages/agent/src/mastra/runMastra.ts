import { Agent } from "@mastra/core/agent";
import { logger } from "@repo/logger";

export interface RunMastraOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

export const runMastra = async ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  apiKey,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunMastraOptions): Promise<{ text: string; events: [] }> => {
  if (apiKey) {
    process.env["KIMI_API_KEY"] = apiKey;
  }

  const resolvedModel = model ?? "kimi-for-coding/k2p6";

  logger.info(
    { cwd, model: typeof resolvedModel === "string" ? resolvedModel : "custom" },
    "runMastra: starting",
  );
  await onProgress?.(
    `[Mastra] Starting agent (cwd=${cwd}, model=${typeof resolvedModel === "string" ? resolvedModel : "custom"})...`,
  );

  const agent = new Agent({
    id: "ordine-mastra-agent",
    name: "Ordine Mastra Agent",
    instructions: systemPrompt,
    model: resolvedModel,
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
  logger.info({ len: result.text.length, durationMs }, "runMastra: complete");
  await onProgress?.(`[Mastra] Complete (${result.text.length} chars, ${durationMs}ms)`);

  return { text: result.text, events: [] };
};
