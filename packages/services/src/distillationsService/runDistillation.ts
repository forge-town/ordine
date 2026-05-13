import { ResultAsync } from "neverthrow";
import { extractJsonFromText } from "@repo/agent";
import type {
  createAgentRawExportsDao,
  createAgentSpansDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createPipelinesDao,
  createSettingsDao,
} from "@repo/models";
import { logger } from "@repo/logger";
import { DistillationCompletedResultSchema, withMeta } from "@repo/schemas";
import { z } from "zod/v4";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";
import { normalizeDistillationRecord } from "./normalizers";
import { buildDistillationUserPrompt, DEFAULT_DISTILLATION_SYSTEM_PROMPT } from "./promptBuilder";
import { buildSourceSnapshot } from "./snapshotBuilder";

const DISTILLATION_AGENT_ID = "distillation-studio";

const parseDistillationResult = ({ raw }: { raw: string }) => {
  const json = extractJsonFromText(raw);
  const parsedJson = JSON.parse(json);
  const parsed = DistillationCompletedResultSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new Error(z.prettifyError(parsed.error));
  }

  return parsed.data;
};

export const runDistillation = async ({
  id,
  distillationsDao,
  jobsDao,
  jobTracesDao,
  agentRawExportsDao,
  agentSpansDao,
  pipelinesDao,
  settingsDao,
}: {
  id: string;
  distillationsDao: ReturnType<typeof createDistillationsDao>;
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>;
  agentSpansDao: ReturnType<typeof createAgentSpansDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
}) => {
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

  const settings = normalizeSettingsRecord(await settingsDao.get());
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
};
