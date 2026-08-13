import type {
  createAgentRuntimesDao,
  createConversationMessagesDao,
  createJobsDao,
  createJobTracesDao,
  createOperationsDao,
  createSettingsDao,
} from "@repo/models";
import { logger } from "@repo/logger";
import { validatePipelineActions } from "@repo/pipeline-engine";
import {
  PipelineGraphSnapshotSchema,
  PipelineActionProposalSchema,
  type AgentContextPayload,
  type ArtifactAnalysis,
  type CapabilityCatalogEntry,
  type ProposeAttachment,
  type PipelineGraphSnapshot,
  type ProposeActionsResponse,
} from "@repo/schemas";
import { normalizeSettingsRecord } from "../../settingsService/normalizeSettingsRecord";
import type { createCapabilityCatalogService } from "../../capabilityCatalogService";
import {
  deriveCapabilityAssignmentAgentTargets,
  validateAssignedOperationExecutor,
  type AssignmentRuntimeRecord,
} from "../capabilityAssignment";
import { analyzeArtifacts } from "./analyzeArtifacts";
import { buildProposeUserPrompt } from "./buildProposePrompt";
import { setProposeProgress } from "./progressStore";
import { loadActiveRun } from "./loadActiveRun";
import { loadConversationHistory } from "./loadConversationHistory";
import { normalizeProposalActionCatalogNames } from "./normalizeProposalActionCatalogNames";
import { normalizeProposalPayload } from "./normalizeProposalPayload";
import { parseProposeAgentOutput } from "./parseAgentOutput";
import { runProposeAgent } from "./runProposeAgent";
import { screenNewOperations, toPendingOperations } from "./screenNewOperations";
import { validateProposalActionCatalog } from "./validateProposalCatalog";
import { validateRejectedOperationReferences } from "./validateRejectedOperationReferences";

export type ProposeActionsDeps = {
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  conversationMessagesDao: ReturnType<typeof createConversationMessagesDao>;
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
  capabilityCatalog: Pick<
    ReturnType<typeof createCapabilityCatalogService>,
    "getMany" | "validateOperationConfigs"
  >;
};

export type ProposeActionsOptions = {
  attachments?: ProposeAttachment[];
  /**
   * Frontend buildAgentContext output — what the ContextStrip shows is
   * exactly what the agent receives.
   */
  context?: AgentContextPayload;
  diagnostics?: string[];
  failedProposal?: unknown;
  snapshot: PipelineGraphSnapshot;
  message: string;
  pipelineId?: string;
  pipelineName?: string;
  referencedNodeIds?: string[];
  runtimeId?: string;
  /** Internal: counts schema-failure auto-retry rounds. Not exposed via API. */
  semanticRetry?: number;
  /** Internal: stage-one analysis carried across the semantic retry round. */
  precomputedAnalysis?: ArtifactAnalysis;
  /**
   * Token the frontend polls stage events with; stages are only written at
   * real call boundaries.
   */
  progressToken?: string;
};

const MAX_SEMANTIC_RETRIES = 1;
const MAX_DIAGNOSTIC_ISSUES = 5;

export type ProposeActionsResult = ProposeActionsResponse;

export const proposeActions = async (
  deps: ProposeActionsDeps,
  opts: ProposeActionsOptions,
): Promise<ProposeActionsResult> => {
  const { agentRuntimesDao, conversationMessagesDao, operationsDao, settingsDao } = deps;
  const progress = (stage: Parameters<typeof setProposeProgress>[1]) => {
    if (opts.progressToken) {
      setProposeProgress(opts.progressToken, stage);
    }
  };
  progress("thinking");
  const parsedSnapshot = PipelineGraphSnapshotSchema.safeParse(opts.snapshot);
  if (!parsedSnapshot.success) {
    logger.warn({ error: parsedSnapshot.error }, "proposeActions: invalid pipeline graph snapshot");

    return { proposal: null, diagnostics: [], error: { code: "INVALID_SNAPSHOT" } };
  }

  const snapshot = parsedSnapshot.data;
  const settings = normalizeSettingsRecord(await settingsDao.get());
  const configuredRuntimes = await agentRuntimesDao.findMany();
  const selectedRuntime = opts.runtimeId
    ? (configuredRuntimes.find((runtime) => runtime.id === opts.runtimeId) ?? null)
    : null;

  if (opts.runtimeId && !selectedRuntime) {
    logger.warn({ runtimeId: opts.runtimeId }, "proposeActions: runtime not found");

    return {
      proposal: null,
      diagnostics: [],
      error: { code: "RUNTIME_NOT_FOUND", detail: opts.runtimeId },
    };
  }

  const capabilityCatalogResult = await deps.capabilityCatalog.getMany();
  if (capabilityCatalogResult.isErr()) {
    logger.error(
      { error: capabilityCatalogResult.error },
      "proposeActions: failed to load capability catalog",
    );
  }
  const capabilityCatalogAvailable = capabilityCatalogResult.isOk();
  const capabilityCatalog: CapabilityCatalogEntry[] = capabilityCatalogResult.isOk()
    ? capabilityCatalogResult.value
    : [];
  const agentTargets = deriveCapabilityAssignmentAgentTargets(
    configuredRuntimes as AssignmentRuntimeRecord[],
  );

  const defaultRuntime =
    configuredRuntimes.find((runtime) => runtime.type === settings.defaultAgentRuntime) ?? null;
  const effectiveRuntime = selectedRuntime ?? defaultRuntime;
  const operations = await operationsDao.findMany();
  const operationCatalog = operations.map((operation) => ({
    id: operation.id,
    name: operation.name,
    description: operation.description,
    acceptedObjectTypes: operation.acceptedObjectTypes,
    executor:
      operation.config && typeof operation.config === "object" && "executor" in operation.config
        ? operation.config.executor
        : undefined,
  }));
  const editableOperationIds = new Set(
    snapshot.nodes.flatMap((node) =>
      node.data.nodeType === "operation" ? [node.data.operationId] : [],
    ),
  );
  const operationById = new Map(
    operationCatalog.map((operation) => [operation.id, { name: operation.name }]),
  );
  const history = await loadConversationHistory(
    { conversationMessagesDao },
    opts.pipelineId,
    opts.message,
  );
  const activeRun = await loadActiveRun(
    { jobsDao: deps.jobsDao, jobTracesDao: deps.jobTracesDao },
    opts.context?.runState,
    opts.pipelineId,
  );
  // Stage one: attachments with real content go through structural analysis
  // first; the semantic retry round reuses the first round's result.
  const textAttachments = (opts.attachments ?? []).filter(
    (attachment) => (attachment.content?.length ?? 0) > 0,
  );
  if (!opts.precomputedAnalysis && textAttachments.length > 0) {
    progress("analyzing");
  }
  const artifactAnalysis =
    opts.precomputedAnalysis ??
    (textAttachments.length > 0
      ? await analyzeArtifacts({
          agent: effectiveRuntime?.type ?? settings.defaultAgentRuntime,
          apiKey: settings.defaultApiKey,
          attachments: opts.attachments ?? [],
          message: opts.message,
          model: settings.defaultModel,
          operationCatalog,
          ssh:
            effectiveRuntime?.connection.mode === "ssh" ? effectiveRuntime.connection : undefined,
        })
      : undefined);
  const userPromptText = buildProposeUserPrompt({
    activeRun,
    agentTargets,
    artifactAnalysis,
    attachments: opts.attachments ?? [],
    capabilityCatalog,
    context: opts.context,
    diagnostics: opts.diagnostics ?? [],
    failedProposal: opts.failedProposal,
    history,
    message: opts.message,
    operationCatalog,
    pipelineId: opts.pipelineId,
    pipelineName: opts.pipelineName,
    referencedNodeIds: opts.referencedNodeIds ?? [],
    snapshot,
  });

  progress("drafting");
  const agentResult = await runProposeAgent({
    agent: effectiveRuntime?.type ?? settings.defaultAgentRuntime,
    apiKey: settings.defaultApiKey,
    model: settings.defaultModel,
    ssh: effectiveRuntime?.connection.mode === "ssh" ? effectiveRuntime.connection : undefined,
    userPrompt: userPromptText,
  });
  if (!agentResult.ok) {
    // runStructuredAgent reports terminal failures via code/detail; the caller
    // owns the single error log per failure. The full detail may embed raw
    // model output, spawn/SSH/provider errors, or operational configuration,
    // so it goes to the log only — the response carries a stable, generic
    // detail for both terminal failure codes.
    logger.error(
      { code: agentResult.code, detail: agentResult.detail },
      agentResult.code === "AGENT_FAILED"
        ? "proposeActions: agent failed after retries"
        : "proposeActions: agent returned invalid JSON",
    );

    return {
      proposal: null,
      diagnostics: [],
      error: {
        code: agentResult.code,
        detail:
          agentResult.code === "BAD_AGENT_OUTPUT"
            ? "agent returned invalid JSON"
            : "agent failed after retries",
      },
    };
  }

  progress("validating");
  const agentOutput = parseProposeAgentOutput(agentResult.json);
  const clarifyOptions =
    agentOutput.clarifyOptions.length > 0 ? agentOutput.clarifyOptions : undefined;
  const {
    accepted: acceptedNewOperations,
    diagnostics: newOperationDiagnostics,
    rejectedIds: rejectedNewOperationIds,
  } = screenNewOperations(agentOutput.newOperations, operationById);
  const pendingOperations = toPendingOperations(acceptedNewOperations);
  for (const operation of pendingOperations) {
    operationById.set(operation.id, { name: operation.name });
  }

  if (agentOutput.proposalPayload === null) {
    if (agentOutput.reply) {
      return {
        ...(artifactAnalysis ? { artifactAnalysis } : {}),
        clarifyOptions,
        diagnostics: newOperationDiagnostics,
        proposal: null,
        reply: agentOutput.reply,
      };
    }

    logger.error(
      { json: agentResult.json },
      "proposeActions: agent returned neither reply nor proposal",
    );

    return { proposal: null, diagnostics: [], error: { code: "BAD_AGENT_OUTPUT" } };
  }

  const normalizedProposal = normalizeProposalPayload(agentOutput.proposalPayload);
  const parsed = PipelineActionProposalSchema.safeParse(normalizedProposal);
  if (!parsed.success) {
    logger.error(
      { error: parsed.error },
      "proposeActions: invalid PipelineActionProposal from agent",
    );

    // Do not silently drop the proposal: feed the validation issues back to the
    // agent once so it can return a corrected version.
    if ((opts.semanticRetry ?? 0) < MAX_SEMANTIC_RETRIES) {
      const issueSummaries = parsed.error.issues
        .slice(0, MAX_DIAGNOSTIC_ISSUES)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
      logger.warn(
        { issues: issueSummaries },
        "proposeActions: retrying once with schema diagnostics",
      );

      return proposeActions(deps, {
        ...opts,
        diagnostics: [...(opts.diagnostics ?? []), ...issueSummaries],
        failedProposal: agentOutput.proposalPayload,
        precomputedAnalysis: artifactAnalysis,
        semanticRetry: (opts.semanticRetry ?? 0) + 1,
      });
    }

    if (agentOutput.reply) {
      // Keep the conversational reply even when the structured proposal is unusable,
      // but surface that the proposal itself was dropped.
      return {
        clarifyOptions,
        diagnostics: [],
        error: { code: "BAD_AGENT_OUTPUT", detail: "proposal failed schema validation" },
        proposal: null,
        reply: agentOutput.reply,
      };
    }

    return {
      proposal: null,
      diagnostics: [],
      error: { code: "BAD_AGENT_OUTPUT", detail: "proposal failed schema validation" },
    };
  }

  // Auto-correct operationName against the catalog (including accepted
  // pending operations) before validating; only ids the catalog does not
  // know survive to become diagnostics.
  const proposal = {
    ...parsed.data,
    actions: normalizeProposalActionCatalogNames(parsed.data.actions, operationById),
  };
  const updateOperationActions = proposal.actions.filter(
    (action) => action.type === "updateOperation",
  );
  const updateOperationDiagnostics = updateOperationActions.flatMap((action) => {
    if (!capabilityCatalogAvailable) {
      return [
        `updateOperation.${action.operationId}: capability catalog is unavailable; executor changes fail closed.`,
      ];
    }

    if (!editableOperationIds.has(action.operationId)) {
      return [
        `updateOperation.${action.operationId}: only an existing Operation used by the current pipeline may be updated in place.`,
      ];
    }

    return validateAssignedOperationExecutor({
      executor: action.executor,
      context: { agentTargets, capabilityCatalog },
      pathPrefix: `updateOperation.${action.operationId}.executor`,
    });
  });
  if (updateOperationActions.length > 0 && capabilityCatalogAvailable) {
    const catalogValidation = await deps.capabilityCatalog.validateOperationConfigs(
      updateOperationActions.map((action) => ({
        executor: action.executor,
        inputs: [],
        outputs: [],
      })),
    );
    if (catalogValidation.isErr()) {
      updateOperationDiagnostics.push(catalogValidation.error.message);
    }
  }

  if (updateOperationDiagnostics.length > 0) {
    if ((opts.semanticRetry ?? 0) < MAX_SEMANTIC_RETRIES) {
      return proposeActions(deps, {
        ...opts,
        diagnostics: [...(opts.diagnostics ?? []), ...updateOperationDiagnostics],
        failedProposal: proposal,
        precomputedAnalysis: artifactAnalysis,
        semanticRetry: (opts.semanticRetry ?? 0) + 1,
      });
    }

    return {
      proposal: null,
      diagnostics: updateOperationDiagnostics.map((message) => ({
        actionIndex: null,
        code: "INVALID_NODE_DATA" as const,
        message,
        severity: "error" as const,
      })),
      error: { code: "BAD_AGENT_OUTPUT", detail: "updateOperation failed validation" },
      ...(agentOutput.reply ? { reply: agentOutput.reply } : {}),
    };
  }
  const validationResult = validatePipelineActions(snapshot, proposal.actions);
  const graphDiagnostics = validationResult.isErr() ? validationResult.error : [];
  const operationDiagnostics = validateProposalActionCatalog(proposal.actions, operationById);
  const rejectedReferenceDiagnostics = validateRejectedOperationReferences(
    proposal.actions,
    rejectedNewOperationIds,
  );

  return {
    ...(artifactAnalysis ? { artifactAnalysis } : {}),
    ...(agentOutput.pipelineName ? { pipelineName: agentOutput.pipelineName } : {}),
    clarifyOptions,
    diagnostics: [
      ...graphDiagnostics,
      ...operationDiagnostics,
      ...rejectedReferenceDiagnostics,
      ...newOperationDiagnostics,
    ],
    ...(pendingOperations.length > 0 ? { pendingOperations } : {}),
    proposal,
    reply: agentOutput.reply ?? proposal.summary,
  };
};
