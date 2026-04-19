import type {
  AgentRawExportsDaoInstance,
  AgentSpansDaoInstance,
} from "@repo/models";
import type { AgentSystem, SpanType, SpanStatus } from "@repo/db-schema";

export interface SpanRecorderDeps {
  agentRawExportsDao: AgentRawExportsDaoInstance;
  agentSpansDao: AgentSpansDaoInstance;
}

const spanRecorderState = {
  deps: null as SpanRecorderDeps | null,
};

export const initSpanRecorder = (deps: SpanRecorderDeps) => {
  spanRecorderState.deps = deps;
};

const getDeps = (): SpanRecorderDeps => {
  if (!spanRecorderState.deps) {
    throw new Error("spanRecorder not initialized — call initSpanRecorder(deps) first");
  }

  return spanRecorderState.deps;
};

export interface RecordAgentRunOptions {
  jobId: string;
  agentSystem: AgentSystem;
  agentId: string;
  modelId?: string | null;
  rawPayload: unknown;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  durationMs?: number | null;
  status?: "completed" | "error";
}

export const recordAgentRun = async (options: RecordAgentRunOptions) => {
  const { agentRawExportsDao } = getDeps();

  return agentRawExportsDao.insert(options);
};

export interface RecordSpanOptions {
  jobId: string;
  rawExportId?: number | null;
  parentSpanId?: number | null;
  spanType: SpanType;
  name: string;
  input?: string | null;
  output?: string | null;
  modelId?: string | null;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  durationMs?: number | null;
  status?: SpanStatus;
  error?: string | null;
  metadata?: unknown;
  startedAt?: Date;
  finishedAt?: Date | null;
}

export const recordSpan = async (options: RecordSpanOptions) => {
  const { agentSpansDao } = getDeps();

  return agentSpansDao.insert(options);
};

export const recordSpans = async (spans: RecordSpanOptions[]) => {
  const { agentSpansDao } = getDeps();

  return agentSpansDao.insertMany(spans);
};

/**
 * Record a complete agent run: raw export + parsed spans in one call.
 */
export const recordAgentRunWithSpans = async (
  runOptions: RecordAgentRunOptions,
  buildSpans: (rawExportId: number) => RecordSpanOptions[],
) => {
  const rawExport = await recordAgentRun(runOptions);
  const spans = buildSpans(rawExport.id);
  const insertedSpans = await recordSpans(spans);

  return { rawExport, spans: insertedSpans };
};
