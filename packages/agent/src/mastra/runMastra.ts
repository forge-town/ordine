import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { DefaultExporter, Observability } from "@mastra/observability";
import { PostgresStore } from "@mastra/pg";
import { logger } from "@repo/logger";
import { ResultAsync } from "neverthrow";

import { getEnv } from "../integrations/env";

export interface RunMastraOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

const buildObservability = (): Observability => {
  return new Observability({
    configs: {
      default: {
        serviceName: "ordine",
        exporters: [new DefaultExporter()],
      },
    },
  });
};

export const runMastra = async ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  apiKey,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunMastraOptions): Promise<{ text: string; events: [] }> => {
  const env = getEnv();

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

  const observability = buildObservability();

  const mastra = new Mastra({
    agents: { "ordine-mastra-agent": agent },
    observability,
    ...(env.DATABASE_URL
      ? {
          storage: new PostgresStore({
            id: "ordine-storage",
            connectionString: env.DATABASE_URL,
          }),
        }
      : {}),
  });
  const tracedAgent = mastra.getAgent("ordine-mastra-agent");

  const startTime = Date.now();

  const result = await Promise.race([
    tracedAgent.generate(userPrompt),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`mastra timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    }),
  ]);

  const durationMs = Date.now() - startTime;
  logger.info({ len: result.text.length, durationMs }, "runMastra: complete");
  await onProgress?.(`[Mastra] Complete (${result.text.length} chars, ${durationMs}ms)`);

  // Flush traces before returning
  const shutdownResult = await ResultAsync.fromPromise(observability.shutdown(), (error) => error);

  if (shutdownResult.isErr()) {
    logger.warn({ error: shutdownResult.error }, "runMastra: failed to flush observability");
  }

  return { text: result.text, events: [] };
};
