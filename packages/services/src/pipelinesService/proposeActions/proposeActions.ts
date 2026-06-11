import type {
  createAgentRuntimesDao,
  createConversationMessagesDao,
  createOperationsDao,
  createSettingsDao,
} from "@repo/models";
import { logger } from "@repo/logger";
import { validatePipelineActions } from "@repo/pipeline-engine";
import {
  PipelineGraphSnapshotSchema,
  PipelineActionProposalSchema,
  type ConversationAttachment,
  type PipelineGraphSnapshot,
  type ProposeActionsResponse,
} from "@repo/schemas";
import { normalizeSettingsRecord } from "../../settingsService/normalizeSettingsRecord";
import { buildProposeUserPrompt } from "./buildProposePrompt";
import type { ProposeHistoryMessage } from "./conversationHistory";
import { normalizeProposalPayload } from "./normalizeProposalPayload";
import { parseProposeAgentOutput } from "./parseAgentOutput";
import { runProposeAgent } from "./runProposeAgent";
import { validateProposalActionCatalog } from "./validateProposalCatalog";

export type ProposeActionsDeps = {
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  conversationMessagesDao: ReturnType<typeof createConversationMessagesDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
};

/**
 * Load the pipeline conversation as prompt history. The current user message
 * is persisted before proposeActions is called, so a trailing duplicate of it
 * is dropped to avoid repeating the USER REQUEST section.
 */
const loadConversationHistory = async (
  conversationMessagesDao: ProposeActionsDeps["conversationMessagesDao"],
  pipelineId: string | undefined,
  currentMessage: string,
): Promise<ProposeHistoryMessage[]> => {
  if (!pipelineId) {
    return [];
  }

  const rows = await conversationMessagesDao.getByPipelineId(pipelineId);
  const trailing = rows.at(-1);
  const withoutCurrent =
    trailing && trailing.role === "user" && trailing.content.trim() === currentMessage.trim()
      ? rows.slice(0, -1)
      : rows;

  return withoutCurrent.map((row) => ({
    content: row.content,
    hasProposal: Boolean((row.metadata as { proposalSnapshot?: unknown } | null)?.proposalSnapshot),
    role: row.role === "user" ? "user" : "agent",
  }));
};

export type ProposeActionsOptions = {
  attachments?: ConversationAttachment[];
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
};

const MAX_SEMANTIC_RETRIES = 1;
const MAX_DIAGNOSTIC_ISSUES = 5;

export type ProposeActionsResult = ProposeActionsResponse;

export const proposeActions = async (
  deps: ProposeActionsDeps,
  opts: ProposeActionsOptions,
): Promise<ProposeActionsResult> => {
  const { agentRuntimesDao, conversationMessagesDao, operationsDao, settingsDao } = deps;
  const parsedSnapshot = PipelineGraphSnapshotSchema.safeParse(opts.snapshot);
  if (!parsedSnapshot.success) {
    logger.warn({ error: parsedSnapshot.error }, "proposeActions: invalid pipeline graph snapshot");

    return { proposal: null, diagnostics: [] };
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
      reply: `Selected runtime "${opts.runtimeId}" is not available.`,
    };
  }

  const defaultRuntime =
    configuredRuntimes.find((runtime) => runtime.type === settings.defaultAgentRuntime) ?? null;
  const effectiveRuntime = selectedRuntime ?? defaultRuntime;
  const operations = await operationsDao.findMany();
  const operationCatalog = operations.map((operation) => ({
    id: operation.id,
    name: operation.name,
    description: operation.description,
    acceptedObjectTypes: operation.acceptedObjectTypes,
  }));
  const operationById = new Map(
    operationCatalog.map((operation) => [operation.id, { name: operation.name }]),
  );
  const history = await loadConversationHistory(
    conversationMessagesDao,
    opts.pipelineId,
    opts.message,
  );
  const userPromptText = buildProposeUserPrompt({
    attachments: opts.attachments ?? [],
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

  const parsedJson = await runProposeAgent({
    agent: effectiveRuntime?.type ?? settings.defaultAgentRuntime,
    apiKey: settings.defaultApiKey,
    model: settings.defaultModel,
    ssh: effectiveRuntime?.connection.mode === "ssh" ? effectiveRuntime.connection : undefined,
    userPrompt: userPromptText,
  });
  if (parsedJson === undefined) {
    return { proposal: null, diagnostics: [] };
  }

  const agentOutput = parseProposeAgentOutput(parsedJson);
  const clarifyOptions =
    agentOutput.clarifyOptions.length > 0 ? agentOutput.clarifyOptions : undefined;

  if (agentOutput.proposalPayload === null) {
    if (agentOutput.reply) {
      return { clarifyOptions, diagnostics: [], proposal: null, reply: agentOutput.reply };
    }

    logger.error({ json: parsedJson }, "proposeActions: agent returned neither reply nor proposal");

    return { proposal: null, diagnostics: [] };
  }

  const normalizedProposal = normalizeProposalPayload(agentOutput.proposalPayload);
  const parsed = PipelineActionProposalSchema.safeParse(normalizedProposal);
  if (!parsed.success) {
    logger.error(
      { error: parsed.error },
      "proposeActions: invalid PipelineActionProposal from agent",
    );

    // Do not silently drop the proposal: feed the validation issues back to the
    // agent once so it can return a corrected version (manual N13-00).
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
        semanticRetry: (opts.semanticRetry ?? 0) + 1,
      });
    }

    if (agentOutput.reply) {
      // Keep the conversational reply even when the structured proposal is unusable.
      return { clarifyOptions, diagnostics: [], proposal: null, reply: agentOutput.reply };
    }

    return { proposal: null, diagnostics: [] };
  }

  const proposal = parsed.data;
  const validationResult = validatePipelineActions(snapshot, proposal.actions);
  const graphDiagnostics = validationResult.isErr() ? validationResult.error : [];
  const operationDiagnostics = validateProposalActionCatalog(proposal.actions, operationById);

  return {
    clarifyOptions,
    diagnostics: [...graphDiagnostics, ...operationDiagnostics],
    proposal,
    reply: agentOutput.reply ?? proposal.summary,
  };
};
