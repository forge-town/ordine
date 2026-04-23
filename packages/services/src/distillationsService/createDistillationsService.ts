import { ResultAsync } from "neverthrow";
import { extractJsonFromText } from "@repo/agent";
import {
  createAgentRawExportsDao,
  createAgentSpansDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createPipelinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { logger } from "@repo/logger";
import {
  DistillationCompletedResultSchema,
  DistillationConfigSchema,
  type DistillationConfig,
  type Distillation,
  type DistillationResult,
  DistillationResultSchema,
  withMeta,
} from "@repo/schemas";
import { z } from "zod/v4";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";

const DISTILLATION_AGENT_ID = "distillation-studio";
const MAX_PROMPT_SNAPSHOT_CHARS = 30_000;

const DISTILLATION_RESULT_EXAMPLE = {
  type: "completed" as const,
  summary: "Concise statement of what the source material reveals.",
  insights: [
    "Key insight 1",
    "Key insight 2",
  ],
  minimalPath: [
    "Step 1",
    "Step 2",
  ],
  reusableAssets: [
    {
      type: "pipeline_template" as const,
      title: "Reusable template name",
      content: "Template, patch, or knowledge card content.",
    },
  ],
  nextActions: [
    "Concrete next action 1",
    "Concrete next action 2",
  ],
};

const DEFAULT_DISTILLATION_SYSTEM_PROMPT = [
  "You are a strict distillation agent.",
  "Transform raw source material into reusable structured insight.",
  "Prefer concrete evidence, extract the minimum viable path, and avoid filler.",
  "Return only JSON that exactly matches the requested schema.",
].join("\n");

const normalizeDistillationConfig = (config: unknown) => {
  const parsed = DistillationConfigSchema.safeParse(config);

  return parsed.success ? parsed.data : DistillationConfigSchema.parse({ objective: "" });
};

const normalizeDistillationResult = (result: unknown) => {
  const parsed = DistillationResultSchema.safeParse(result);

  return parsed.success ? parsed.data : null;
};

const normalizeDistillationRecord = <
  T extends {
    config: unknown;
    result: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  record: T,
): Omit<T, "config" | "result"> & {
  config: DistillationConfig;
  result: DistillationResult | null;
} => ({
  ...record,
  config: normalizeDistillationConfig(record.config),
  result: normalizeDistillationResult(record.result),
});

const MODE_GUIDANCE: Record<Distillation["mode"], string> = {
  pipeline:
    "Identify the critical path, noisy steps, reusable pipeline pattern, and concrete optimization actions.",
  failure:
    "Identify the failure pattern, root causes, anti-patterns, and guardrails that prevent recurrence.",
  prompt:
    "Identify the effective prompting pattern, what should be removed, and the most reusable prompt assets.",
  knowledge:
    "Extract the durable knowledge units, patterns, and the most reusable takeaways.",
};

const stringifyForPrompt = (value: unknown): string => {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= MAX_PROMPT_SNAPSHOT_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_PROMPT_SNAPSHOT_CHARS)}\n... (truncated)`;
};

const buildJobSnapshot = async ({
  sourceId,
  jobsDao,
  jobTracesDao,
  agentRawExportsDao,
  agentSpansDao,
}: {
  sourceId: string;
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>;
  agentSpansDao: ReturnType<typeof createAgentSpansDao>;
}) => {
  const [job, traces, agentRuns, spans] = await Promise.all([
    jobsDao.findById(sourceId),
    jobTracesDao.findByJobId(sourceId),
    agentRawExportsDao.findByJobId(sourceId),
    agentSpansDao.findByJobId(sourceId),
  ]);

  return {
    kind: "job",
    job,
    traces: traces.slice(0, 60).map((trace) => ({
      level: trace.level,
      message: trace.message,
      createdAt: trace.createdAt,
    })),
    agentRuns: agentRuns.slice(0, 8).map((run) => ({
      id: run.id,
      agentSystem: run.agentSystem,
      agentId: run.agentId,
      modelId: run.modelId,
      tokenInput: run.tokenInput,
      tokenOutput: run.tokenOutput,
      durationMs: run.durationMs,
      status: run.status,
      createdAt: run.createdAt,
      rawPayloadPreview: stringifyForPrompt(run.rawPayload).slice(0, 8_000),
    })),
    spans: spans.slice(0, 80).map((span) => ({
      spanType: span.spanType,
      name: span.name,
      status: span.status,
      durationMs: span.durationMs,
      modelId: span.modelId,
      startedAt: span.startedAt,
      finishedAt: span.finishedAt,
    })),
  };
};

const buildPipelineSnapshot = async ({
  sourceId,
  pipelinesDao,
}: {
  sourceId: string;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
}) => {
  const pipeline = await pipelinesDao.findById(sourceId);

  return {
    kind: "pipeline",
    pipeline,
  };
};

const buildManualSnapshot = ({ distillation }: { distillation: Distillation }) => ({
  kind: "manual",
  sourceLabel: distillation.sourceLabel,
  summary: distillation.summary,
  objective: distillation.config.objective,
  existingInputSnapshot: distillation.inputSnapshot,
});

const buildSourceSnapshot = async ({
  distillation,
  jobsDao,
  jobTracesDao,
  agentRawExportsDao,
  agentSpansDao,
  pipelinesDao,
}: {
  distillation: Distillation;
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>;
  agentSpansDao: ReturnType<typeof createAgentSpansDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
}) => {
  if (distillation.sourceType === "job" && distillation.sourceId) {
    return buildJobSnapshot({
      sourceId: distillation.sourceId,
      jobsDao,
      jobTracesDao,
      agentRawExportsDao,
      agentSpansDao,
    });
  }

  if (distillation.sourceType === "pipeline" && distillation.sourceId) {
    return buildPipelineSnapshot({
      sourceId: distillation.sourceId,
      pipelinesDao,
    });
  }

  return buildManualSnapshot({ distillation });
};

const buildDistillationUserPrompt = ({
  distillation,
  sourceSnapshot,
}: {
  distillation: Distillation;
  sourceSnapshot: unknown;
}) => {
  return [
    `Distillation title: ${distillation.title}`,
    `Mode: ${distillation.mode}`,
    `Source type: ${distillation.sourceType}`,
    `Source label: ${distillation.sourceLabel || "—"}`,
    `Existing summary: ${distillation.summary || "—"}`,
    `Objective: ${distillation.config.objective || "Extract the most reusable insight."}`,
    "",
    "Focus guidance:",
    MODE_GUIDANCE[distillation.mode],
    "",
    "Return ONLY a JSON object matching this exact shape:",
    JSON.stringify(DISTILLATION_RESULT_EXAMPLE, null, 2),
    "",
    "Source snapshot:",
    stringifyForPrompt(sourceSnapshot),
  ].join("\n");
};

const parseDistillationResult = ({ raw }: { raw: string }) => {
  const json = extractJsonFromText(raw);
  const parsedJson = JSON.parse(json);
  const parsed = DistillationCompletedResultSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new Error(z.prettifyError(parsed.error));
  }

  return parsed.data;
};

export const createDistillationsService = (db: DbConnection) => {
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const settingsDao = createSettingsDao(db);

  return {
    getAll: async () => {
      const records = await distillationsDao.findMany();

      return records.map((record) => withMeta(normalizeDistillationRecord(record)));
    },
    getById: async (id: string) => {
      const record = await distillationsDao.findById(id);

      if (!record) {
        return undefined;
      }

      return withMeta(normalizeDistillationRecord(record));
    },
    create: async (...args: Parameters<typeof distillationsDao.create>) =>
      withMeta(normalizeDistillationRecord(await distillationsDao.create(...args))),
    update: async (...args: Parameters<typeof distillationsDao.update>) => {
      const record = await distillationsDao.update(...args);

      return withMeta(record ? normalizeDistillationRecord(record) : undefined);
    },
    delete: (id: string) => distillationsDao.delete(id),
    run: async (id: string) => {
      const record = await distillationsDao.findById(id);
      if (!record) {
        return undefined;
      }

      const distillation = normalizeDistillationRecord(record);

      const sourceSnapshot = await buildSourceSnapshot({
        distillation,
        jobsDao,
        jobTracesDao,
        agentRawExportsDao,
        agentSpansDao,
        pipelinesDao,
      });

      await distillationsDao.update(id, {
        status: "running",
        inputSnapshot: sourceSnapshot,
        result: null,
      });

      const settings = await settingsDao.get();
      const userPrompt = buildDistillationUserPrompt({
        distillation,
        sourceSnapshot,
      });
      const systemPrompt =
        distillation.config.systemPrompt?.trim() || DEFAULT_DISTILLATION_SYSTEM_PROMPT;

      const execution = await ResultAsync.fromPromise(
        runAgent({
          agent: distillation.config.agent ?? settings.defaultAgentRuntime,
          systemPrompt,
          userPrompt,
          inputPath: process.cwd(),
          agentId: DISTILLATION_AGENT_ID,
          allowedTools: [],
          logPrefix: "runDistillation",
          apiKey: settings.defaultApiKey,
          model: distillation.config.model ?? settings.defaultModel,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      ).andThen((raw) =>
        ResultAsync.fromPromise(
          Promise.resolve().then(() => ({
            raw,
            parsed: parseDistillationResult({ raw }),
          })),
          (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
        ),
      );

      return execution.match(
        async ({ parsed }) =>
          withMeta(
            await distillationsDao.update(id, {
              status: "completed",
              summary: parsed.summary,
              inputSnapshot: sourceSnapshot,
              result: parsed,
            }),
          ),
        async (error) => {
          logger.error({ err: error, distillationId: id }, "runDistillation: failed");

          return withMeta(
            await distillationsDao.update(id, {
              status: "failed",
              inputSnapshot: sourceSnapshot,
              result: {
                type: "failed",
                error: error.message,
              },
            }),
          );
        },
      );
    },
  };
};
