import { Result, ResultAsync } from "neverthrow";
import type {
  createAgentRuntimesDao,
  createOperationsDao,
  createSettingsDao,
} from "@repo/models";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { validatePipelineActions } from "@repo/pipeline-engine";
import {
  PipelineGraphSnapshotSchema,
  PipelineActionProposalSchema,
  type ConversationAttachment,
  type PipelineGraphSnapshot,
  type PipelineActionDiagnostic,
  type PipelineActionProposal,
} from "@repo/schemas";
import { runAgent } from "../../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../../settingsService/normalizeSettingsRecord";
import {
  PROPOSE_AGENT_ID,
  PROPOSE_SYSTEM_PROMPT,
  buildProposeUserPrompt,
} from "./buildProposePrompt";
import { normalizeProposalPayload } from "./normalizeProposalPayload";
import { validateProposalActionCatalog } from "./validateProposalCatalog";

export type ProposeActionsDeps = {
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
};

export type ProposeActionsOptions = {
  attachments?: ConversationAttachment[];
  snapshot: PipelineGraphSnapshot;
  message: string;
  pipelineId?: string;
  pipelineName?: string;
  referencedNodeIds?: string[];
  runtimeId?: string;
};

export type ProposeActionsResult = {
  proposal: PipelineActionProposal | null;
  diagnostics: PipelineActionDiagnostic[];
  reply?: string;
};

export const proposeActions = async (
  deps: ProposeActionsDeps,
  opts: ProposeActionsOptions,
): Promise<ProposeActionsResult> => {
  const { agentRuntimesDao, operationsDao, settingsDao } = deps;
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
  const userPromptText = buildProposeUserPrompt({
    attachments: opts.attachments ?? [],
    message: opts.message,
    operationCatalog,
    pipelineId: opts.pipelineId,
    pipelineName: opts.pipelineName,
    referencedNodeIds: opts.referencedNodeIds ?? [],
    snapshot,
  });

  const MAX_RETRIES = 3;
  const execution = await (async () => {
    for (const attempt of Array.from({ length: MAX_RETRIES }, (_, i) => i + 1)) {
      const result = await ResultAsync.fromPromise(
        runAgent({
          agent: effectiveRuntime?.type ?? settings.defaultAgentRuntime,
          systemPrompt: PROPOSE_SYSTEM_PROMPT,
          userPrompt: userPromptText,
          inputPath: process.cwd(),
          agentId: PROPOSE_AGENT_ID,
          allowedTools: [],
          logPrefix: "proposeActions",
          apiKey: settings.defaultApiKey,
          model: settings.defaultModel,
          ssh: effectiveRuntime?.connection.mode === "ssh" ? effectiveRuntime.connection : undefined,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );
      if (result.isOk()) return result;
      if (attempt === MAX_RETRIES) return result;
      logger.warn(
        { attempt, err: result.error.message },
        "proposeActions: agent attempt failed, retrying",
      );
    }

    return undefined;
  })();

  if (!execution || execution.isErr()) {
    logger.error({ err: execution?.error }, "proposeActions: agent failed after retries");

    return { proposal: null, diagnostics: [] };
  }

  const raw = execution.value;
  const extractJsonResult = Result.fromThrowable(
    extractJsonFromText,
    () => new Error("failed to extract JSON from agent response"),
  )(raw);
  if (extractJsonResult.isErr()) {
    logger.error({ raw }, "proposeActions: failed to extract JSON from agent response");

    return { proposal: null, diagnostics: [] };
  }

  const parseJsonResult = Result.fromThrowable(
    JSON.parse,
    () => new Error("extracted text is not valid JSON"),
  )(extractJsonResult.value);
  if (parseJsonResult.isErr()) {
    logger.error(
      { json: extractJsonResult.value },
      "proposeActions: extracted text is not valid JSON",
    );

    return { proposal: null, diagnostics: [] };
  }

  const normalizedProposal = normalizeProposalPayload(parseJsonResult.value);
  const parsed = PipelineActionProposalSchema.safeParse(normalizedProposal);
  if (!parsed.success) {
    logger.error({ error: parsed.error }, "proposeActions: invalid PipelineActionProposal from agent");

    return { proposal: null, diagnostics: [] };
  }

  const proposal = parsed.data;
  const validationResult = validatePipelineActions(snapshot, proposal.actions);
  const graphDiagnostics = validationResult.isErr() ? validationResult.error : [];
  const operationDiagnostics = validateProposalActionCatalog(proposal.actions, operationById);

  return {
    proposal,
    diagnostics: [...graphDiagnostics, ...operationDiagnostics],
  };
};
