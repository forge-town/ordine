import "../text-imports.d.ts";

import { homedir } from "node:os";
import { join } from "node:path";
import nodeTypesRef from "../../../../skills/ordine-create-pipeline/references/node-types.md" with { type: "text" };
import pipelineAnatomyRef from "../../../../skills/ordine-create-pipeline/references/pipeline-anatomy.md" with { type: "text" };
import {
  createAgentRuntimesDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createOperationsDao,
  createPipelineRunsDao,
  createPipelinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { logger } from "@repo/logger";
import {
  PipelineSchema,
  type AgentRuntime,
  type ObjectNodeType,
  type PipelineData,
} from "@repo/schemas";
import { runStructuredAgent } from "../pipelineRunnerService/agentRunner/runStructuredAgent";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";
import { MAX_SNAPSHOT_CHARS, truncate } from "./promptText";
import { proposeActions, type ProposeActionsOptions } from "./proposeActions";
import {
  ANALYZE_AGENT_ID,
  ANALYZE_SYSTEM_PROMPT,
  buildGenerateSystemPrompt,
  buildOptimizeSystemPrompt,
  GENERATE_AGENT_ID,
  OPTIMIZE_AGENT_ID,
} from "./prompts";

const expandTilde = (p: string): string =>
  p.startsWith("~/") ? join(homedir(), p.slice(2)) : p === "~" ? homedir() : p;

const expandTildeInNodes = (nodes: PipelineData["nodes"]): PipelineData["nodes"] =>
  nodes.map((node) => {
    const { data } = node;
    if (data.nodeType === "folder" && data.folderPath) {
      return { ...node, data: { ...data, folderPath: expandTilde(data.folderPath) } };
    }
    if (data.nodeType === "output-local-path" && data.localPath) {
      return { ...node, data: { ...data, localPath: expandTilde(data.localPath) } };
    }

    return node;
  });

const SKILL_REFERENCES = [nodeTypesRef, pipelineAnatomyRef].filter(Boolean).join("\n\n---\n\n");

export const createPipelinesService = (db: DbConnection) => {
  const agentRuntimesDao = createAgentRuntimesDao(db);
  const dao = createPipelinesDao(db);
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const pipelineRunsDao = createPipelineRunsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const operationsDao = createOperationsDao(db);
  const settingsDao = createSettingsDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    createPendingOperations: async (
      pendingOperations: Array<{
        id: string;
        name: string;
        description: string;
        config: Record<string, unknown>;
        acceptedObjectTypes: ObjectNodeType[];
        sourceSkillId?: string;
      }>,
    ) => {
      for (const op of pendingOperations) {
        await operationsDao.create(op);
      }
    },
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: async (id: string) => {
      await pipelineRunsDao.deleteByPipelineId(id);
      await dao.delete(id);
    },

    proposeActions: (opts: ProposeActionsOptions) =>
      proposeActions({ agentRuntimesDao, operationsDao, settingsDao }, opts),

    optimizeFromDistillation: async (opts: {
      distillationId: string;
      userPrompt: string;
    }): Promise<PipelineData | undefined> => {
      const distillationRecord = await distillationsDao.findById(opts.distillationId);
      if (!distillationRecord) return undefined;

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

      const context = { jobContext: "", sourcePipelineContext: "" };
      if (distillationRecord.sourceType === "job" && distillationRecord.sourceId) {
        const [job, traces] = await Promise.all([
          jobsDao.findById(distillationRecord.sourceId),
          jobTracesDao.findByJobId(distillationRecord.sourceId),
        ]);
        context.jobContext = [
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

        if (job) {
          const pipelineRun = await pipelineRunsDao.findByJobId(job.id);
          if (pipelineRun?.pipelineId) {
            const sourcePipeline = await dao.findById(pipelineRun.pipelineId);
            if (sourcePipeline) {
              context.sourcePipelineContext = [
                "Original Pipeline (use this as reference for input/output nodes):",
                truncate(JSON.stringify(sourcePipeline, null, 2), MAX_SNAPSHOT_CHARS),
              ].join("\n");
            }
          }
        }
      }

      // Build structured distillation sections for the prompt
      const distResult = distillationRecord.result as Record<string, unknown> | null;
      const nextActions = Array.isArray(distResult?.nextActions)
        ? (distResult.nextActions as string[]).map((a, i) => `  ${i + 1}. ${a}`).join("\n")
        : "(none)";
      const minimalPath = Array.isArray(distResult?.minimalPath)
        ? (distResult.minimalPath as string[]).map((s, i) => `  ${i + 1}. ${s}`).join("\n")
        : "(none)";
      const insights = Array.isArray(distResult?.insights)
        ? (distResult.insights as string[]).map((s, i) => `  ${i + 1}. ${s}`).join("\n")
        : "(none)";
      const reusableAssets = Array.isArray(distResult?.reusableAssets)
        ? truncate(JSON.stringify(distResult.reusableAssets, null, 2), MAX_SNAPSHOT_CHARS)
        : "(none)";

      const userPromptText = [
        "=== REQUIRED ACTIONS (implement ALL of these) ===",
        nextActions,
        "",
        "=== OPTIMAL EXECUTION PATH (design pipeline to follow this) ===",
        minimalPath,
        "",
        "=== INSIGHTS (problems to fix) ===",
        insights,
        "",
        "=== REUSABLE ASSETS (use as blueprint if applicable) ===",
        reusableAssets,
        "",
        "=== ORIGINAL PIPELINE (preserve input sources, optimize processing) ===",
        context.sourcePipelineContext || "(no source pipeline found)",
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
        "=== ADDITIONAL CONTEXT ===",
        `User guidance: ${opts.userPrompt}`,
        `Distillation summary: ${distResult?.summary ?? ""}`,
        "",
        context.jobContext ? `Source job context:\n${context.jobContext}` : "",
        "",
        "Generate the optimized pipeline JSON now. Return ONLY the JSON.",
      ].join("\n");

      const optimizePrompt = buildOptimizeSystemPrompt(SKILL_REFERENCES);

      const structured = await runStructuredAgent({
        agent: settings.defaultAgentRuntime,
        systemPrompt: optimizePrompt,
        userPrompt: userPromptText,
        agentId: OPTIMIZE_AGENT_ID,
        logPrefix: "optimizePipeline",
        apiKey: settings.defaultApiKey,
        model: settings.defaultModel,
      });

      if (!structured.ok) {
        logger.error(
          { code: structured.code, detail: structured.detail },
          structured.code === "AGENT_FAILED"
            ? "optimizePipeline: agent failed after retries"
            : "optimizePipeline: agent returned invalid JSON",
        );

        return undefined;
      }

      const rawParsed = structured.json as {
        id: string;
        nodes?: Array<{ data: { nodeType?: string; sourceType?: string } }>;
      };

      // Sanitize known LLM output issues before Zod validation
      if (Array.isArray(rawParsed.nodes)) {
        for (const node of rawParsed.nodes) {
          if (node.data?.nodeType === "github-projects" && node.data.sourceType === "remote") {
            node.data.sourceType = "github";
          }
        }
      }

      // Ensure unique ID to avoid collisions with existing pipelines
      const existingPipeline = await dao.findById(rawParsed.id);
      if (existingPipeline) {
        rawParsed.id = `${rawParsed.id}_${Date.now()}`;
      }

      const parsed = PipelineSchema.omit({ createdAt: true, updatedAt: true }).safeParse(rawParsed);

      if (!parsed.success) {
        logger.error({ error: parsed.error }, "optimizePipeline: invalid pipeline JSON from agent");

        return undefined;
      }

      const created = await dao.create({
        ...parsed.data,
        nodes: expandTildeInNodes(parsed.data.nodes) as never,
        edges: parsed.data.edges as never,
      });

      return created;
    },

    analyzeIntent: async (opts: {
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

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

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
    },

    generateStructure: async (opts: {
      name: string;
      description: string;
      matchedOperations?: Array<{ operationId: string; operationName: string; reason: string }>;
      unmatchedSteps?: Array<{ step: string; reason: string }>;
      runtimeType?: AgentRuntime;
    }): Promise<
      | {
          nodes: PipelineData["nodes"];
          edges: PipelineData["edges"];
          pendingOperations?: Array<{
            id: string;
            name: string;
            description: string;
            config: Record<string, unknown>;
            acceptedObjectTypes: ObjectNodeType[];
          }>;
        }
      | { error: string }
    > => {
      if (!opts.description.trim()) {
        return { nodes: [] as PipelineData["nodes"], edges: [] as PipelineData["edges"] };
      }

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

      const pendingOperations: Array<{
        id: string;
        name: string;
        description: string;
        config: Record<string, unknown>;
        acceptedObjectTypes: ObjectNodeType[];
      }> = [];
      const newOperations: Array<{ id: string; name: string; description: string }> = [];

      if (opts.unmatchedSteps && opts.unmatchedSteps.length > 0) {
        for (const step of opts.unmatchedSteps) {
          const opId = `op_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const systemPrompt = [
            `You are an automation agent executing the task: "${step.step}".`,
            step.reason ? `Context: ${step.reason}` : "",
            "",
            "You will receive input data from the previous pipeline step.",
            "Analyze the input thoroughly and execute the task described above.",
            "Output your results in well-structured markdown format.",
            "Be specific, actionable, and data-driven in your output.",
          ]
            .filter(Boolean)
            .join("\n");
          const config = {
            executor: {
              type: "agent",
              agentMode: "prompt",
              prompt: systemPrompt,
            },
            inputs: [],
            outputs: [
              {
                name: "result",
                contentType: "markdown",
                description: "Generated result",
                templateIds: [],
              },
            ],
          };
          pendingOperations.push({
            id: opId,
            name: step.step,
            description: step.reason,
            config,
            acceptedObjectTypes: ["file", "folder", "github-project", "prompt"] as ObjectNodeType[],
          });
          newOperations.push({ id: opId, name: step.step, description: step.reason });
          logger.info(
            { opId, name: step.step },
            "generateStructure: prepared pending operation for unmatched step",
          );
        }
      }

      const allOperations = [
        ...operations.map((op) => ({
          id: op.id,
          name: op.name,
          description: op.description,
          acceptedObjectTypes: op.acceptedObjectTypes,
        })),
        ...newOperations.map((op) => ({
          id: op.id,
          name: op.name,
          description: op.description,
          acceptedObjectTypes: ["file", "folder", "github-project", "prompt"] as ObjectNodeType[],
        })),
      ];

      const matchedBlock =
        opts.matchedOperations && opts.matchedOperations.length > 0
          ? [
              "",
              "=== PRE-MATCHED OPERATIONS (MUST USE) ===",
              "The following operations have already been confirmed as matching the user's intent.",
              "You MUST include ALL of them as operation nodes in the pipeline, using the EXACT operationId and operationName.",
              "Do NOT substitute, skip, or replace any of these with other operations.",
              JSON.stringify(opts.matchedOperations, null, 2),
              "",
            ]
          : [];

      const newOpsBlock =
        newOperations.length > 0
          ? [
              "",
              "=== NEWLY CREATED OPERATIONS (MUST USE) ===",
              "The following operations were just created specifically for this pipeline's unmatched steps.",
              "You MUST include ALL of them as operation nodes in the pipeline, using the EXACT id and name.",
              JSON.stringify(newOperations, null, 2),
              "",
            ]
          : [];

      const userPromptText = [
        `=== PIPELINE GOAL ===`,
        `Name: ${opts.name}`,
        `Description: ${opts.description}`,
        ...matchedBlock,
        ...newOpsBlock,
        `=== AVAILABLE OPERATIONS (${allOperations.length}) ===`,
        JSON.stringify(allOperations, null, 2),
        "",
        "Generate the pipeline structure JSON now. Return ONLY the JSON with nodes and edges.",
      ].join("\n");

      const systemPrompt = buildGenerateSystemPrompt(SKILL_REFERENCES);

      const structured = await runStructuredAgent({
        agent: opts.runtimeType ?? settings.defaultAgentRuntime,
        systemPrompt,
        userPrompt: userPromptText,
        agentId: GENERATE_AGENT_ID,
        logPrefix: "generateStructure",
        apiKey: settings.defaultApiKey,
        model: settings.defaultModel,
      });

      if (!structured.ok) {
        if (structured.code === "AGENT_FAILED") {
          logger.error(
            { detail: structured.detail },
            "generateStructure: agent failed after retries",
          );

          return { error: "Agent failed to generate pipeline structure after retries" };
        }
        logger.error(
          { detail: structured.detail },
          "generateStructure: failed to parse agent output as JSON",
        );

        return { error: "Agent returned invalid JSON" };
      }

      const NodesEdgesSchema = PipelineSchema.pick({ nodes: true, edges: true });
      const validated = NodesEdgesSchema.safeParse(structured.json);

      if (!validated.success) {
        logger.error({ error: validated.error }, "generateStructure: invalid structure from agent");

        return { error: "Agent returned invalid pipeline structure" };
      }

      return {
        nodes: expandTildeInNodes(validated.data.nodes),
        edges: validated.data.edges,
        ...(pendingOperations.length > 0 ? { pendingOperations } : {}),
      };
    },
  };
};
