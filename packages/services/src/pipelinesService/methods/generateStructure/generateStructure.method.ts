import "../../../text-imports.d.ts";

import { logger } from "@repo/logger";
import {
  PipelineSchema,
  type AgentRuntime,
  type ObjectNodeType,
  type PipelineData,
} from "@repo/schemas";
import { isConnectionAllowed } from "@repo/pipeline-engine/schemas";
import { runStructuredAgent } from "../../../pipelineRunnerService/helpers/runStructuredAgent/runStructuredAgent.helper";
import { normalizeSettingsRecord } from "../../../settingsService/helpers/normalizeSettingsRecord";

import { PIPELINE_CANVAS_SKILL_CONTEXT } from "../../helpers/pipelineCanvasSkillContext/pipelineCanvasSkillContext.helper";

import { CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT } from "../../helpers/buildCapabilityAssignmentPrompt";
import {
  deriveCapabilityAssignmentAgentTargets,
  resolveAssignmentOrchestrator,
  type AssignmentRuntimeRecord,
} from "../../helpers/resolveAssignmentRuntime";
import { planCapabilityAssignments } from "../../helpers/planCapabilityAssignments";

import { buildGenerateSystemPrompt, GENERATE_AGENT_ID } from "../../helpers/prompts/prompts.helper";
import {
  MAX_STRUCTURE_DIAGNOSTIC_ISSUES,
  MAX_STRUCTURE_SCHEMA_RETRIES,
  CAPABILITY_ASSIGNMENT_AGENT_ID,
  type PipelinesServiceBindings,
} from "../../contracts";

import { expandTildeInNodes } from "../../helpers/expandTildeInNodes";
import { buildAssignedOperationConfig } from "../../helpers/buildAssignedOperationConfig";
import { sanitizeGeneratedGraph } from "../../helpers/sanitizeGeneratedGraph";

export const createGenerateStructureMethod =
  (
    serviceBindings: Pick<
      PipelinesServiceBindings,
      "settingsDao" | "operationsDao" | "agentRuntimesDao" | "getCapabilityCatalog" | "db"
    >,
  ) =>
  async (opts: {
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

    const settings = normalizeSettingsRecord(await serviceBindings.settingsDao.get());
    const operations = await serviceBindings.operationsDao.findMany();

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
        serviceBindings.agentRuntimesDao.findMany(),
        (0, serviceBindings.getCapabilityCatalog)(serviceBindings.db).getMany(),
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

      const capabilityValidation = await (0, serviceBindings.getCapabilityCatalog)(
        serviceBindings.db,
      ).validateOperationConfigs(pendingOperations.map((operation) => operation.config));
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

    const systemPrompt = buildGenerateSystemPrompt(PIPELINE_CANVAS_SKILL_CONTEXT);

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
  };
