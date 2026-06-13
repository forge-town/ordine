import { recordAgentRunWithSpans, type RecordSpanOptions } from "@repo/obs";
import { logger } from "@repo/logger";
import { AgentRuntime } from "@repo/schemas";
import type { ClaudeStreamEvent } from "@repo/agent";
import { ResultAsync } from "neverthrow";
import type { DriverResult } from "../types";

export const extractTokenTotals = (events: ClaudeStreamEvent[]): { input: number; output: number } => {
  const resultEvent = events.find((e) => e.type === "result");
  const modelUsage = resultEvent?.modelUsage;

  return Object.values(modelUsage ?? {}).reduce(
    (totals, usageEntry) => ({
      input: totals.input + (usageEntry.inputTokens ?? 0),
      output: totals.output + (usageEntry.outputTokens ?? 0),
    }),
    { input: 0, output: 0 },
  );
};

const buildSpans = ({
  events,
  jobId,
  rawExportId,
  agentId,
  userPrompt,
  output,
  durationMs,
  startTime,
}: {
  events: ClaudeStreamEvent[];
  jobId: string;
  rawExportId: number;
  agentId: string;
  userPrompt: string;
  output: string;
  durationMs: number;
  startTime: number;
}): RecordSpanOptions[] => {
  if (events.length === 0) {
    return [
      {
        jobId,
        rawExportId,
        spanType: "agent_run",
        name: agentId,
        input: userPrompt.slice(0, 10_000),
        output: output.slice(0, 10_000),
        modelId: null,
        tokenInput: null,
        tokenOutput: null,
        durationMs,
        status: "completed",
        startedAt: new Date(startTime),
        finishedAt: new Date(),
      },
    ];
  }

  const spans: RecordSpanOptions[] = [];
  const baseTime = new Date(startTime);
  let spanCounter = 0;

  for (const ev of events) {
    if (ev.type === "assistant" && ev.message?.content) {
      const model = ev.message.model ?? null;
      for (const block of ev.message.content) {
        spanCounter += 1;
        if (block.type === "thinking" && block.thinking) {
          spans.push({
            jobId,
            rawExportId,
            spanType: "llm_call",
            name: `thinking-${spanCounter}`,
            input: null,
            output: block.thinking.slice(0, 10_000),
            modelId: model,
            status: "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
          });
        } else if (block.type === "text" && block.text) {
          spans.push({
            jobId,
            rawExportId,
            spanType: "llm_call",
            name: `text-${spanCounter}`,
            input: null,
            output: block.text.slice(0, 10_000),
            modelId: model,
            status: "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
          });
        } else if (block.type === "tool_use") {
          spans.push({
            jobId,
            rawExportId,
            spanType: "tool_call",
            name: block.name ?? `tool-${spanCounter}`,
            input: block.input ? JSON.stringify(block.input).slice(0, 10_000) : null,
            output: null,
            modelId: model,
            status: "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
            metadata: block.id ? { toolUseId: block.id } : null,
          });
        }
      }
    }

    if (ev.type === "user" && ev.message?.content) {
      for (const block of ev.message.content) {
        if (block.type === "tool_result") {
          spanCounter += 1;
          const resultText =
            typeof block.content === "string"
              ? block.content
              : block.content == null
                ? null
                : JSON.stringify(block.content);
          spans.push({
            jobId,
            rawExportId,
            spanType: "tool_result",
            name: `result-${spanCounter}`,
            input: null,
            output: resultText ? resultText.slice(0, 10_000) : null,
            status: block.is_error ? "error" : "completed",
            startedAt: baseTime,
            finishedAt: new Date(),
            metadata: block.tool_use_id ? { toolUseId: block.tool_use_id } : null,
          });
        }
      }
    }

    if (ev.type === "result") {
      spans.push({
        jobId,
        rawExportId,
        spanType: "agent_run",
        name: agentId,
        input: null,
        output: null,
        durationMs: ev.duration_ms ?? null,
        status: "completed",
        startedAt: baseTime,
        finishedAt: new Date(),
        metadata: {
          totalCost: ev.total_cost_usd,
          modelUsage: ev.modelUsage,
          numTurns: ev.num_turns,
        },
      });
    }
  }

  return spans;
};

export const recordObservability = async ({
  jobId,
  agentId,
  agent,
  systemPrompt,
  userPrompt,
  result,
  startTime,
}: {
  jobId: string;
  agentId: string;
  agent: AgentRuntime;
  systemPrompt: string;
  userPrompt: string;
  result: DriverResult;
  startTime: number;
}) => {
  const durationMs = Date.now() - startTime;
  const tokenTotals = extractTokenTotals(result.events);

  const obsResult = await ResultAsync.fromPromise(
    recordAgentRunWithSpans(
      {
        jobId,
        agentRuntime: agent,
        agentId,
        modelId: null,
        rawPayload: {
          system: systemPrompt,
          prompt: userPrompt,
          output: result.text,
          ...(result.events.length > 0 ? { events: result.events } : {}),
        },
        tokenInput: tokenTotals.input || null,
        tokenOutput: tokenTotals.output || null,
        durationMs,
        status: "completed",
      },
      (rawExportId) =>
        buildSpans({
          events: result.events,
          jobId,
          rawExportId,
          agentId,
          userPrompt,
          output: result.text,
          durationMs,
          startTime,
        }),
    ),
    (err) => err,
  );

  if (obsResult.isErr()) {
    logger.warn(
      { err: obsResult.error, agentId, jobId },
      "agentEngine: failed to record observability",
    );
  }
};
