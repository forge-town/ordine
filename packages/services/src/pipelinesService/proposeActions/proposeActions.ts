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
  type ConversationAttachment,
  type PipelineGraphSnapshot,
  type ProposeActionsResponse,
  type ProposePendingOperation,
} from "@repo/schemas";
import { normalizeSettingsRecord } from "../../settingsService/normalizeSettingsRecord";
import { buildProposeUserPrompt, type ProposeActiveRun } from "./buildProposePrompt";
import type { ProposeHistoryMessage } from "./conversationHistory";
import { normalizeProposalPayload } from "./normalizeProposalPayload";
import { parseProposeAgentOutput, type ParsedNewOperation } from "./parseAgentOutput";
import { runProposeAgent } from "./runProposeAgent";
import { validateProposalActionCatalog } from "./validateProposalCatalog";

export type ProposeActionsDeps = {
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  conversationMessagesDao: ReturnType<typeof createConversationMessagesDao>;
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
};

const MAX_ACTIVE_RUN_TRACES = 30;

/**
 * N12-03：消息携带 runState 时取 job + 最近 traces。job 不存在或未携带
 * runState 时返回 undefined——prompt 中不注入也不声称有运行上下文。
 */
const loadActiveRun = async (
  deps: Pick<ProposeActionsDeps, "jobsDao" | "jobTracesDao">,
  runState: NonNullable<ProposeActionsOptions["context"]>["runState"],
): Promise<ProposeActiveRun | undefined> => {
  if (!runState) {
    return undefined;
  }

  const job = await deps.jobsDao.findById(runState.jobId);
  if (!job) {
    logger.warn({ jobId: runState.jobId }, "proposeActions: runState job not found");

    return undefined;
  }

  const traces = await deps.jobTracesDao.findByJobId(runState.jobId);

  return {
    jobId: job.id,
    jobStatus: job.status,
    nodeStatuses: runState.nodeStatuses,
    // findByJobId 返回最新在前；截取后翻转为 oldest-first 供 prompt 阅读。
    traces: traces
      .slice(0, MAX_ACTIVE_RUN_TRACES)
      .reverse()
      .map((trace) => ({ level: trace.level, message: trace.message })),
  };
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
  /** 前端 buildAgentContext 输出——Strip 所见即 Agent 所得（N12-02）。 */
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
};

const MAX_SEMANTIC_RETRIES = 1;
const MAX_DIAGNOSTIC_ISSUES = 5;

/** Materialize agent-drafted operations as pending operation configs (PRD §7.3). */
const toPendingOperations = (newOperations: ParsedNewOperation[]): ProposePendingOperation[] =>
  newOperations.map((operation) => ({
    acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
    config: {
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt:
          operation.prompt.trim().length > 0
            ? operation.prompt
            : [
                `You are an automation agent executing the task: "${operation.name}".`,
                operation.description ? `Context: ${operation.description}` : "",
                "",
                "You will receive input data from the previous pipeline step.",
                "Analyze the input thoroughly and execute the task described above.",
                "Output your results in well-structured markdown format.",
              ]
                .filter(Boolean)
                .join("\n"),
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
    },
    description: operation.description,
    id: operation.id,
    name: operation.name,
  }));

export type ProposeActionsResult = ProposeActionsResponse;

export const proposeActions = async (
  deps: ProposeActionsDeps,
  opts: ProposeActionsOptions,
): Promise<ProposeActionsResult> => {
  const { agentRuntimesDao, conversationMessagesDao, operationsDao, settingsDao } = deps;
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
  const activeRun = await loadActiveRun(deps, opts.context?.runState);
  const userPromptText = buildProposeUserPrompt({
    activeRun,
    attachments: opts.attachments ?? [],
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

  const agentResult = await runProposeAgent({
    agent: effectiveRuntime?.type ?? settings.defaultAgentRuntime,
    apiKey: settings.defaultApiKey,
    model: settings.defaultModel,
    ssh: effectiveRuntime?.connection.mode === "ssh" ? effectiveRuntime.connection : undefined,
    userPrompt: userPromptText,
  });
  if (!agentResult.ok) {
    return {
      proposal: null,
      diagnostics: [],
      error: { code: agentResult.code, detail: agentResult.detail },
    };
  }

  const agentOutput = parseProposeAgentOutput(agentResult.json);
  const clarifyOptions =
    agentOutput.clarifyOptions.length > 0 ? agentOutput.clarifyOptions : undefined;
  const pendingOperations = toPendingOperations(agentOutput.newOperations);
  for (const operation of pendingOperations) {
    operationById.set(operation.id, { name: operation.name });
  }

  if (agentOutput.proposalPayload === null) {
    if (agentOutput.reply) {
      return { clarifyOptions, diagnostics: [], proposal: null, reply: agentOutput.reply };
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

  const proposal = parsed.data;
  const validationResult = validatePipelineActions(snapshot, proposal.actions);
  const graphDiagnostics = validationResult.isErr() ? validationResult.error : [];
  const operationDiagnostics = validateProposalActionCatalog(proposal.actions, operationById);

  return {
    clarifyOptions,
    diagnostics: [...graphDiagnostics, ...operationDiagnostics],
    ...(pendingOperations.length > 0 ? { pendingOperations } : {}),
    proposal,
    reply: agentOutput.reply ?? proposal.summary,
  };
};
