import { ResultAsync } from "neverthrow";
import {
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  createOperationsDao,
  createPipelinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { PipelineSchema, type PipelineData } from "@repo/pipeline-engine/schemas";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";

const OPTIMIZE_AGENT_ID = "pipeline-optimizer";

const OPTIMIZE_SYSTEM_PROMPT = [
  "You are a pipeline optimization agent for Ordine, an AI-first pipeline orchestration platform.",
  "Given a distillation result (insights from a previous pipeline run) and available operations,",
  "generate an improved pipeline as a JSON object.",
  "",
  "The pipeline JSON must match this EXACT schema:",
  "{",
  '  "id": "<uuid>",',
  '  "name": "string",',
  '  "description": "string",',
  '  "tags": ["string"],',
  '  "timeoutMs": null,',
  '  "nodes": [PipelineNode],',
  '  "edges": [PipelineEdge]',
  "}",
  "",
  "Each node MUST have this shape:",
  "{",
  '  "id": "<unique-string>",',
  '  "type": "operation",',
  '  "position": { "x": 0, "y": <increment by 200> },',
  '  "data": {',
  '    "nodeType": "operation",   <-- REQUIRED discriminator, must be exactly "operation"',
  '    "label": "Display Name",',
  '    "operationId": "<id from available operations>",',
  '    "operationName": "<name from available operations>",',
  '    "status": "idle"',
  "  }",
  "}",
  "",
  "Each edge:",
  '{ "id": "<unique-string>", "source": "<nodeId>", "target": "<nodeId>" }',
  "",
  "Rules:",
  "- Use ONLY operations from the provided operations list (match by id and name)",
  '- Every node.data MUST include "nodeType": "operation" and "status": "idle"',
  "- Arrange nodes top to bottom with ~200px vertical spacing",
  "- Connect nodes with edges to form a directed acyclic graph",
  "- The pipeline should address insights and next actions from the distillation",
  "- Return ONLY the JSON object, no markdown, no explanation, no code fences",
].join("\n");

const MAX_SNAPSHOT_CHARS = 20_000;
const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}\n... (truncated)`;

export const createPipelinesService = (db: DbConnection) => {
  const dao = createPipelinesDao(db);
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const operationsDao = createOperationsDao(db);
  const settingsDao = createSettingsDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: (id: string) => dao.delete(id),

    optimizeFromDistillation: async (opts: {
      distillationId: string;
      userPrompt: string;
    }): Promise<PipelineData | undefined> => {
      const distillationRecord = await distillationsDao.findById(opts.distillationId);
      if (!distillationRecord) return undefined;

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

      let jobContext = "";
      if (distillationRecord.sourceType === "job" && distillationRecord.sourceId) {
        const [job, traces] = await Promise.all([
          jobsDao.findById(distillationRecord.sourceId),
          jobTracesDao.findByJobId(distillationRecord.sourceId),
        ]);
        jobContext = [
          "Source Job:",
          truncate(JSON.stringify(job, null, 2), MAX_SNAPSHOT_CHARS),
          "",
          `Traces (${traces.length}):`,
          truncate(
            JSON.stringify(
              traces.slice(0, 40).map((t) => ({ level: t.level, message: t.message })),
              null,
              2,
            ),
            MAX_SNAPSHOT_CHARS,
          ),
        ].join("\n");
      }

      const userPromptText = [
        `User optimization guidance: ${opts.userPrompt}`,
        "",
        "Distillation result:",
        truncate(JSON.stringify(distillationRecord.result, null, 2), MAX_SNAPSHOT_CHARS),
        "",
        "Input snapshot:",
        truncate(JSON.stringify(distillationRecord.inputSnapshot, null, 2), MAX_SNAPSHOT_CHARS),
        "",
        jobContext,
        "",
        `Available operations (${operations.length}):`,
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
        "Generate a new optimized pipeline JSON. Return ONLY the JSON.",
      ].join("\n");

      const execution = await ResultAsync.fromPromise(
        runAgent({
          agent: settings.defaultAgentRuntime,
          systemPrompt: OPTIMIZE_SYSTEM_PROMPT,
          userPrompt: userPromptText,
          inputPath: process.cwd(),
          agentId: OPTIMIZE_AGENT_ID,
          allowedTools: [],
          logPrefix: "optimizePipeline",
          apiKey: settings.defaultApiKey,
          model: settings.defaultModel,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );

      if (execution.isErr()) {
        logger.error({ err: execution.error }, "optimizePipeline: agent failed");
        return undefined;
      }

      const raw = execution.value;
      const json = extractJsonFromText(raw);
      const parsed = PipelineSchema.omit({ createdAt: true, updatedAt: true }).safeParse(
        JSON.parse(json),
      );

      if (!parsed.success) {
        logger.error({ error: parsed.error }, "optimizePipeline: invalid pipeline JSON from agent");
        return undefined;
      }

      const created = await dao.create({
        ...parsed.data,
        nodes: parsed.data.nodes as never,
        edges: parsed.data.edges as never,
      });

      return created;
    },
  };
};
