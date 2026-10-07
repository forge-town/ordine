import "../../../text-imports.d.ts";

import { logger } from "@repo/logger";
import type { AgentRuntime } from "@repo/schemas";

import { runStructuredAgent } from "../../../pipelineRunnerService/helpers/runStructuredAgent/runStructuredAgent.helper";
import { normalizeSettingsRecord } from "../../../settingsService/helpers/normalizeSettingsRecord";

import { ANALYZE_AGENT_ID, ANALYZE_SYSTEM_PROMPT } from "../../helpers/prompts/prompts.helper";

import type { PipelinesServiceBindings } from "../../contracts";
export const createAnalyzeIntentMethod =
  (serviceBindings: Pick<PipelinesServiceBindings, "settingsDao" | "operationsDao">) =>
  async (opts: {
    name: string;
    description: string;
    runtimeType?: AgentRuntime;
  }): Promise<{
    matchedOperations: Array<{ operationId: string; operationName: string; reason: string }>;
    unmatchedSteps: Array<{ step: string; reason: string }>;
  }> => {
    const EMPTY = {
      matchedOperations: [] as Array<{
        operationId: string;
        operationName: string;
        reason: string;
      }>,
      unmatchedSteps: [] as Array<{ step: string; reason: string }>,
    };

    if (!opts.description.trim()) {
      return EMPTY;
    }

    const settings = normalizeSettingsRecord(await serviceBindings.settingsDao.get());
    const operations = await serviceBindings.operationsDao.findMany();

    const userPromptText = [
      "=== PIPELINE GOAL ===",
      `Name: ${opts.name}`,
      `Description: ${opts.description}`,
      "",
      `=== AVAILABLE OPERATIONS (${operations.length}) ===`,
      JSON.stringify(
        operations.map((op) => ({
          id: op.id,
          name: op.name,
          description: op.description,
          acceptedObjectTypes: op.acceptedObjectTypes,
        })),
        null,
        2,
      ),
      "",
      "Analyze the pipeline goal and match against available operations. Return ONLY the JSON.",
    ].join("\n");

    const structured = await runStructuredAgent({
      agent: opts.runtimeType ?? settings.defaultAgentRuntime,
      systemPrompt: ANALYZE_SYSTEM_PROMPT,
      userPrompt: userPromptText,
      agentId: ANALYZE_AGENT_ID,
      logPrefix: "analyzeIntent",
      apiKey: settings.defaultApiKey,
      model: settings.defaultModel,
      // analyzeIntent has always been a single call; no process-level retry.
      maxRetries: 1,
    });

    if (!structured.ok) {
      logger.error(
        { code: structured.code, detail: structured.detail },
        structured.code === "AGENT_FAILED"
          ? "analyzeIntent: agent failed"
          : "analyzeIntent: failed to parse agent output as JSON",
      );

      return EMPTY;
    }

    const parsed = structured.json as Record<string, unknown>;
    const matchedOperations = Array.isArray(parsed.matchedOperations)
      ? (parsed.matchedOperations as Array<{
          operationId: string;
          operationName: string;
          reason: string;
        }>)
      : [];
    const unmatchedSteps = Array.isArray(parsed.unmatchedSteps)
      ? (parsed.unmatchedSteps as Array<{ step: string; reason: string }>)
      : [];

    return { matchedOperations, unmatchedSteps };
  };
