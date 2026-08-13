import "../text-imports.d.ts";

import { homedir } from "node:os";
import { join, win32 } from "node:path";
import nodeTypesRef from "../../../../skills/ordine-create-pipeline/references/node-types.md" with { type: "text" };
import pipelineAnatomyRef from "../../../../skills/ordine-create-pipeline/references/pipeline-anatomy.md" with { type: "text" };
import {
  createAgentRuntimesDao,
  createConversationMessagesDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createOperationsDao,
  createPipelineRunsDao,
  createPipelinesDao,
  createSettingsDao,
  type DbExecutor,
} from "@repo/models";
import { errAsync, ResultAsync } from "neverthrow";
import { logger } from "@repo/logger";
import {
  PipelineSchema,
  StrictOperationConfigSchema,
  type AssignedOperationExecutorConfig,
  type AgentRuntime,
  type ObjectNodeType,
  type PipelineData,
} from "@repo/schemas";
import { isConnectionAllowed } from "@repo/pipeline-engine/schemas";
import { runStructuredAgent } from "../pipelineRunnerService/agentRunner/runStructuredAgent";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";
import {
  createCapabilityCatalogService,
  type CapabilityCatalogServiceOptions,
} from "../capabilityCatalogService";
import { ConflictError, NotFoundError, ServiceError, toServiceError } from "../serviceErrors";
import { MAX_SNAPSHOT_CHARS, truncate } from "./promptText";
import {
  CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT,
  deriveCapabilityAssignmentAgentTargets,
  planCapabilityAssignments,
  resolveAssignmentOrchestrator,
  type AssignmentRuntimeRecord,
  type PerStepCapabilityAssignment,
} from "./capabilityAssignment";
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

const normalizeGeneratedPath = (path: string): string => {
  const expanded = expandTilde(path);
  if (process.platform !== "win32") {
    return expanded;
  }

  const withoutPosixDrivePrefix = /^\/[a-zA-Z]:[\\/]/.test(expanded) ? expanded.slice(1) : expanded;

  return /^[a-zA-Z]:[\\/]/.test(withoutPosixDrivePrefix)
    ? win32.normalize(withoutPosixDrivePrefix)
    : withoutPosixDrivePrefix;
};

const expandTildeInNodes = (nodes: PipelineData["nodes"]): PipelineData["nodes"] =>
  nodes.map((node) => {
    const { data } = node;
    if (data.nodeType === "folder" && data.folderPath) {
      return { ...node, data: { ...data, folderPath: normalizeGeneratedPath(data.folderPath) } };
    }
    if (data.nodeType === "output-local-path" && data.localPath) {
      return { ...node, data: { ...data, localPath: normalizeGeneratedPath(data.localPath) } };
    }

    return node;
  });

const SKILL_REFERENCES = [nodeTypesRef, pipelineAnatomyRef].filter(Boolean).join("\n\n---\n\n");
const MAX_STRUCTURE_DIAGNOSTIC_ISSUES = 8;
const MAX_STRUCTURE_SCHEMA_RETRIES = 1;
const CAPABILITY_ASSIGNMENT_AGENT_ID = "pipeline-capability-assignment";

const buildAssignedOperationConfig = (assignment: PerStepCapabilityAssignment) => ({
  executor: assignment.executor,
  inputs: [],
  outputs: [
    {
      name: "result",
      contentType: "markdown" as const,
      description: "Generated result",
      templateIds: [],
    },
  ],
});

const sanitizeGeneratedGraph = (value: unknown): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const graph = value as Record<string, unknown>;
  if (!Array.isArray(graph.nodes)) {
    return value;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((nodeValue) => {
      if (!nodeValue || typeof nodeValue !== "object" || Array.isArray(nodeValue)) {
        return nodeValue;
      }

      const node = nodeValue as Record<string, unknown>;
      const dataValue = node.data;
      if (!dataValue || typeof dataValue !== "object" || Array.isArray(dataValue)) {
        return nodeValue;
      }

      const data = { ...(dataValue as Record<string, unknown>) };
      const normalizedType =
        node.type === "github-projects" || data.nodeType === "github-projects"
          ? "github-project"
          : node.type;
      if (data.nodeType === "github-projects") {
        data.nodeType = "github-project";
      }
      if (
        data.nodeType === "github-project" &&
        typeof data.owner !== "string" &&
        typeof data.repo === "string" &&
        data.repo.includes("/")
      ) {
        const [owner, ...repoParts] = data.repo.split("/");
        if (owner && repoParts.length > 0) {
          data.owner = owner;
          data.repo = repoParts.join("/");
        }
      }
      if (
        data.nodeType === "prompt" &&
        (typeof data.prompt !== "string" || data.prompt.trim().length === 0)
      ) {
        data.prompt =
          typeof data.description === "string" && data.description.trim().length > 0
            ? data.description
            : typeof data.label === "string"
              ? data.label
              : "Provide the Pipeline input.";
      }

      return { ...node, type: normalizedType, data };
    }),
  };
};

export interface PipelinesServiceOptions {
  capabilityCatalog?: ReturnType<typeof createCapabilityCatalogService>;
  capabilityCatalogOptions?: CapabilityCatalogServiceOptions;
}

export interface PendingOperationInput {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  acceptedObjectTypes: ObjectNodeType[];
  sourceSkillId?: string;
}

export const createPipelinesService = (db: DbExecutor, options: PipelinesServiceOptions = {}) => {
  const agentRuntimesDao = createAgentRuntimesDao(db);
  const conversationMessagesDao = createConversationMessagesDao(db);
  const dao = createPipelinesDao(db);
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const pipelineRunsDao = createPipelineRunsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const operationsDao = createOperationsDao(db);
  const settingsDao = createSettingsDao(db);
  const getCapabilityCatalog = (executor: DbExecutor) =>
    options.capabilityCatalog ??
    createCapabilityCatalogService(executor, options.capabilityCatalogOptions);
  const insertPendingOperations = async (
    executor: DbExecutor,
    pendingOperations: PendingOperationInput[],
  ): Promise<void> => {
    const validation =
      await getCapabilityCatalog(executor).validateOperationInputs(pendingOperations);
    if (validation.isErr()) throw validation.error;

    const transactionalOperationsDao = createOperationsDao(executor);
    for (const operation of pendingOperations) {
      await transactionalOperationsDao.create(operation);
    }
  };

  const createPendingOperations = (pendingOperations: PendingOperationInput[]) =>
    ResultAsync.fromPromise(
      db.transaction((transaction) => insertPendingOperations(transaction, pendingOperations)),
      (error) => toServiceError(error, "Create pending operations"),
    );

  const createWithPendingOperations = (
    pipeline: Parameters<typeof dao.create>[0],
    pendingOperations: PendingOperationInput[],
  ) =>
    ResultAsync.fromPromise(
      db.transaction(async (transaction) => {
        await insertPendingOperations(transaction, pendingOperations);

        return createPipelinesDao(transaction).create(pipeline);
      }),
      (error) => toServiceError(error, "Create pipeline with pending operations"),
    );

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    createPendingOperations,
    createWithPendingOperations,
    updateOperationExecutors: (
      updates: Array<{
        operationId: string;
        executor: AssignedOperationExecutorConfig;
      }>,
    ) => {
      const seen = new Set<string>();
      const duplicate = updates.find(({ operationId }) => {
        if (seen.has(operationId)) return true;
        seen.add(operationId);

        return false;
      });
      if (duplicate) {
        return errAsync(
          new ConflictError(`Duplicate updateOperation for ${duplicate.operationId}`),
        );
      }

      return ResultAsync.fromPromise(
        Promise.all(
          updates.map(async (update) => {
            const operation = await operationsDao.findById(update.operationId);
            if (!operation) throw new NotFoundError("Operation", update.operationId);

            const parsedConfig = StrictOperationConfigSchema.safeParse(operation.config);
            if (!parsedConfig.success) {
              throw new ServiceError(`Operation:${update.operationId} has invalid stored config`);
            }

            return {
              operationId: update.operationId,
              config: { ...parsedConfig.data, executor: update.executor },
            };
          }),
        ),
        (error) => toServiceError(error, "Prepare operation executor updates"),
      ).andThen((prepared) =>
        getCapabilityCatalog(db)
          .validateOperationConfigs(prepared.map(({ config }) => config))
          .andThen(() =>
            ResultAsync.fromPromise(
              (async () => {
                for (const { operationId, config } of prepared) {
                  await operationsDao.update(operationId, { config });
                }
              })(),
              (error) => toServiceError(error, "Update operation executors"),
            ),
          ),
      );
    },
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: async (id: string) => {
      await pipelineRunsDao.deleteByPipelineId(id);
      await dao.delete(id);
    },

    proposeActions: (opts: ProposeActionsOptions) =>
      proposeActions(
        {
          agentRuntimesDao,
          conversationMessagesDao,
          jobsDao,
          jobTracesDao,
          operationsDao,
          settingsDao,
          capabilityCatalog: getCapabilityCatalog(db),
        },
        opts,
      ),

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
      runtimeId?: string;
      runtimeType?: AgentRuntime;
      model?: string;
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
      const assignmentState = {
        orchestrator: null as ReturnType<typeof resolveAssignmentOrchestrator>,
      };

      if (opts.unmatchedSteps && opts.unmatchedSteps.length > 0) {
        const draftedOperations = opts.unmatchedSteps.map((step) => {
          const opId = `op_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const operationDescription = `Execute this Pipeline step: ${step.step}`;

          return { opId, operationDescription, step };
        });
        const [runtimeRecords, capabilityCatalogResult] = await Promise.all([
          agentRuntimesDao.findMany(),
          getCapabilityCatalog(db).getMany(),
        ]);
        if (capabilityCatalogResult.isErr()) {
          logger.error(
            { error: capabilityCatalogResult.error },
            "generateStructure: failed to load capability catalog",
          );

          return { error: "Capability catalog is unavailable" };
        }

        const assignmentRuntimes = runtimeRecords as AssignmentRuntimeRecord[];
        const assignmentOrchestrator = resolveAssignmentOrchestrator({
          runtimes: assignmentRuntimes,
          requestedRuntimeId: opts.runtimeId,
          requestedRuntimeType: opts.runtimeType,
          requestedModel: opts.model,
          defaultRuntime: settings.defaultAgentRuntime,
          defaultModel: settings.defaultModel,
        });
        assignmentState.orchestrator = assignmentOrchestrator;
        const agentTargets = deriveCapabilityAssignmentAgentTargets(assignmentRuntimes);
        if (!assignmentOrchestrator || agentTargets.length === 0) {
          return { error: "No configured runtime has a usable model catalog" };
        }

        const assignmentContext = {
          steps: draftedOperations.map(({ opId, operationDescription, step }) => ({
            operationId: opId,
            name: step.step,
            description: operationDescription,
          })),
          agentTargets,
          capabilityCatalog: capabilityCatalogResult.value,
        };
        const assignmentPlan = await planCapabilityAssignments({
          context: assignmentContext,
          runAgent: async (userPrompt) => {
            const result = await runStructuredAgent({
              agent: assignmentOrchestrator!.runtime.type,
              systemPrompt: CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT,
              userPrompt,
              agentId: CAPABILITY_ASSIGNMENT_AGENT_ID,
              logPrefix: "assignOperationCapabilities",
              apiKey: settings.defaultApiKey,
              model: assignmentOrchestrator!.model,
              ...(assignmentOrchestrator!.ssh ? { ssh: assignmentOrchestrator!.ssh } : {}),
            });

            return result.ok
              ? { ok: true as const, json: result.json }
              : {
                  ok: false as const,
                  error:
                    result.code === "AGENT_FAILED"
                      ? "Capability assignment agent failed"
                      : "Capability assignment agent returned invalid JSON",
                };
          },
        });
        if (!assignmentPlan.ok) {
          logger.error(
            { diagnostics: assignmentPlan.diagnostics },
            "generateStructure: capability assignment failed after one repair",
          );

          return { error: "Agent returned invalid capability assignments" };
        }

        const assignmentByOperationId = new Map(
          assignmentPlan.assignments.map((assignment) => [assignment.operationId, assignment]),
        );
        for (const { opId, operationDescription, step } of draftedOperations) {
          const assignment = assignmentByOperationId.get(opId)!;
          const config = buildAssignedOperationConfig(assignment);
          pendingOperations.push({
            id: opId,
            name: step.step,
            description: operationDescription,
            config,
            acceptedObjectTypes: ["file", "folder", "github-project", "prompt"] as ObjectNodeType[],
          });
          newOperations.push({ id: opId, name: step.step, description: operationDescription });
          logger.info(
            { opId, name: step.step },
            "generateStructure: prepared pending operation for unmatched step",
          );
        }

        const capabilityValidation = await getCapabilityCatalog(db).validateOperationConfigs(
          pendingOperations.map((operation) => operation.config),
        );
        if (capabilityValidation.isErr()) {
          logger.error(
            { error: capabilityValidation.error },
            "generateStructure: assigned operation failed catalog revalidation",
          );

          return { error: "Generated operation capability validation failed" };
        }
      }

      const hasAnalyzedIntent =
        opts.matchedOperations !== undefined || opts.unmatchedSteps !== undefined;
      const matchedOperationIds = new Set(
        opts.matchedOperations?.map((operation) => operation.operationId) ?? [],
      );
      const relevantExistingOperations = hasAnalyzedIntent
        ? operations.filter((operation) => matchedOperationIds.has(operation.id))
        : operations;
      const allOperations = [
        ...relevantExistingOperations.map((op) => ({
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

      const NodesEdgesSchema = PipelineSchema.pick({ nodes: true, edges: true }).superRefine(
        ({ edges, nodes }, ctx) => {
          const nodeById = new Map(nodes.map((node) => [node.id, node]));
          const seenNodeIds = new Set<string>();

          nodes.forEach((node, index) => {
            if (seenNodeIds.has(node.id)) {
              ctx.addIssue({
                code: "custom",
                message: `Duplicate node id: ${node.id}`,
                path: ["nodes", index, "id"],
              });
            }
            seenNodeIds.add(node.id);

            if (node.type !== node.data.nodeType) {
              ctx.addIssue({
                code: "custom",
                message: `Node type ${node.type} does not match data.nodeType ${node.data.nodeType}`,
                path: ["nodes", index, "data", "nodeType"],
              });
            }
          });

          edges.forEach((edge, index) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source) {
              ctx.addIssue({
                code: "custom",
                message: `Unknown edge source: ${edge.source}`,
                path: ["edges", index, "source"],
              });
            }
            if (!target) {
              ctx.addIssue({
                code: "custom",
                message: `Unknown edge target: ${edge.target}`,
                path: ["edges", index, "target"],
              });
            }
            if (source && target && !isConnectionAllowed(source.type, target.type)) {
              ctx.addIssue({
                code: "custom",
                message: `Connection ${source.type} -> ${target.type} is not allowed`,
                path: ["edges", index],
              });
            }
          });
        },
      );
      const runGenerationAttempt = async (
        prompt: string,
        semanticRetry: number,
      ): Promise<
        { ok: true; data: Pick<PipelineData, "edges" | "nodes"> } | { ok: false; error: string }
      > => {
        const structured = await runStructuredAgent({
          agent:
            assignmentState.orchestrator?.runtime.type ??
            opts.runtimeType ??
            settings.defaultAgentRuntime,
          systemPrompt,
          userPrompt: prompt,
          agentId: GENERATE_AGENT_ID,
          logPrefix: "generateStructure",
          apiKey: settings.defaultApiKey,
          model: assignmentState.orchestrator?.model ?? settings.defaultModel,
          ...(assignmentState.orchestrator?.ssh ? { ssh: assignmentState.orchestrator.ssh } : {}),
        });

        if (!structured.ok) {
          if (structured.code === "AGENT_FAILED") {
            logger.error(
              { detail: structured.detail },
              "generateStructure: agent failed after retries",
            );

            return {
              ok: false,
              error: "Agent failed to generate pipeline structure after retries",
            };
          }
          logger.error(
            { detail: structured.detail },
            "generateStructure: failed to parse agent output as JSON",
          );

          return { ok: false, error: "Agent returned invalid JSON" };
        }

        const sanitizedGraph = sanitizeGeneratedGraph(structured.json);
        const validated = NodesEdgesSchema.safeParse(sanitizedGraph);
        if (validated.success) {
          return { ok: true, data: validated.data };
        }

        const issueSummaries = validated.error.issues
          .slice(0, MAX_STRUCTURE_DIAGNOSTIC_ISSUES)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
        logger.error(
          { error: validated.error, semanticRetry },
          "generateStructure: invalid structure from agent",
        );

        if (semanticRetry >= MAX_STRUCTURE_SCHEMA_RETRIES) {
          return { ok: false, error: "Agent returned invalid pipeline structure" };
        }

        logger.warn(
          { issues: issueSummaries },
          "generateStructure: retrying once with schema diagnostics",
        );
        const repairPrompt = [
          "Repair the following pipeline structure so it passes the reported validation issues.",
          "Preserve the existing intent, node IDs, and valid fields. Do not add commentary.",
          "=== PREVIOUS INVALID STRUCTURE ===",
          JSON.stringify(sanitizedGraph),
          "",
          "=== VALIDATION ISSUES TO FIX ===",
          ...issueSummaries.map((issue) => `- ${issue}`),
          "",
          "Return a corrected complete pipeline structure. Return ONLY the JSON with nodes and edges.",
        ].join("\n");

        return runGenerationAttempt(repairPrompt, semanticRetry + 1);
      };

      const generationResult = await runGenerationAttempt(userPromptText, 0);
      if (!generationResult.ok) {
        return { error: generationResult.error };
      }

      return {
        nodes: expandTildeInNodes(generationResult.data.nodes),
        edges: generationResult.data.edges,
        ...(pendingOperations.length > 0 ? { pendingOperations } : {}),
      };
    },
  };
};
