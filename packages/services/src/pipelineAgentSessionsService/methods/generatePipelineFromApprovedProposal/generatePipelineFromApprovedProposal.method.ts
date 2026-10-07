import { ResultAsync } from "neverthrow";

import {
  createConversationMessagesDao,
  createPipelineAgentSessionsDao,
  createRoutinesDao,
  type DbConnection,
} from "@repo/models";

import { getNextCronRunAt } from "@repo/utils";

import { createPipelinesService } from "../../../pipelinesService";

import { createRuntimeNotFoundError } from "../../helpers/createRuntimeNotFoundError";
import { isCancellationError } from "../../helpers/isCancellationError";
import { runAbortable } from "../../helpers/runAbortable";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createGeneratePipelineFromApprovedProposalMethod =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      | "sessionsDao"
      | "proposalsDao"
      | "beginActivity"
      | "messagesDao"
      | "contextArtifactsDao"
      | "settingsDao"
      | "agentRuntimesDao"
      | "assertActivityActive"
      | "resolveEffectiveRuntime"
      | "buildGenerationDescription"
      | "buildArtifactSummary"
      | "finishActivity"
      | "pipelinesService"
      | "db"
      | "operationsDao"
    >,
  ) =>
  async (sessionId: string, input?: { runtimeId?: string; signal?: AbortSignal }) => {
    const session = await serviceBindings.sessionsDao.findById(sessionId);
    if (!session) {
      throw new Error(`Pipeline agent session not found: ${sessionId}`);
    }
    if (session.mode !== "generate") {
      throw new Error(`Session ${sessionId} is not a generate session`);
    }
    if (!session.approvedProposalId) {
      throw new Error(`Session ${sessionId} does not have an approved proposal`);
    }

    const proposalRecord = await serviceBindings.proposalsDao.findById(session.approvedProposalId);
    if (!proposalRecord || proposalRecord.proposal.mode !== "generate") {
      throw new Error(`Approved generate proposal not found for session ${sessionId}`);
    }
    if (proposalRecord.proposal.readiness !== "ready_for_generation") {
      throw new Error(
        `Approved generate proposal is not ready for generation in session ${sessionId}`,
      );
    }
    const generateProposal = proposalRecord.proposal;
    const activity = (0, serviceBindings.beginActivity)(sessionId, "generating");
    const handleExternalAbort = () => activity.controller.abort();
    input?.signal?.addEventListener("abort", handleExternalAbort, { once: true });

    const preparationResult = await ResultAsync.fromPromise(
      (async () => {
        const [messages, artifacts, settings, runtimes] = await Promise.all([
          serviceBindings.messagesDao.findManyBySessionId(sessionId),
          serviceBindings.contextArtifactsDao.findManyBySessionId(sessionId),
          serviceBindings.settingsDao.get(),
          serviceBindings.agentRuntimesDao.findMany(),
        ]);
        (0, serviceBindings.assertActivityActive)(sessionId, activity);
        const effectiveRuntime = (0, serviceBindings.resolveEffectiveRuntime)({
          requestedRuntimeId: input?.runtimeId,
          runtimes,
          defaultRuntime: settings.defaultAgentRuntime ?? null,
        });
        if (!effectiveRuntime) {
          throw createRuntimeNotFoundError(input?.runtimeId);
        }
        const pipelineName = generateProposal.purpose;
        const pipelineDescription = [
          (0, serviceBindings.buildGenerationDescription)(generateProposal),
          "Conversation context:",
          messages
            .map((message) => `[${message.role}/${message.kind}] ${message.content}`)
            .join("\n") || "(none)",
          "",
          "Attachment context:",
          (0, serviceBindings.buildArtifactSummary)(artifacts),
        ].join("\n\n");

        await serviceBindings.sessionsDao.update(sessionId, { status: "generating" });
        (0, serviceBindings.assertActivityActive)(sessionId, activity);

        return { effectiveRuntime, messages, pipelineDescription, pipelineName };
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (preparationResult.isErr()) {
      await serviceBindings.proposalsDao.update(proposalRecord.id, {
        status: "proposal_ready",
        approvedAt: null,
      });
      await serviceBindings.sessionsDao.update(sessionId, {
        status: "proposal_ready",
        latestProposalId: proposalRecord.id,
        approvedProposalId: null,
        createdPipelineId: null,
      });
      input?.signal?.removeEventListener("abort", handleExternalAbort);
      (0, serviceBindings.finishActivity)(sessionId, activity);
      throw preparationResult.error;
    }
    const { effectiveRuntime, messages, pipelineDescription, pipelineName } =
      preparationResult.value;

    const persistedPipeline = { id: null as string | null };
    const pendingOperationIds = { value: [] as string[] };
    const generationResult = await ResultAsync.fromPromise(
      (async () => {
        (0, serviceBindings.assertActivityActive)(sessionId, activity);
        const analysis = await runAbortable(
          serviceBindings.pipelinesService.analyzeIntent({
            name: pipelineName,
            description: pipelineDescription,
            runtimeType: effectiveRuntime,
          }),
          activity.controller.signal,
          sessionId,
        );
        (0, serviceBindings.assertActivityActive)(sessionId, activity);
        const generated = await runAbortable(
          serviceBindings.pipelinesService.generateStructure({
            name: pipelineName,
            description: pipelineDescription,
            matchedOperations: analysis.matchedOperations,
            unmatchedSteps: analysis.unmatchedSteps,
            runtimeId: input?.runtimeId,
            runtimeType: effectiveRuntime,
          }),
          activity.controller.signal,
          sessionId,
        );
        (0, serviceBindings.assertActivityActive)(sessionId, activity);
        if ("error" in generated) {
          throw new Error(generated.error);
        }
        pendingOperationIds.value =
          generated.pendingOperations?.map((operation) => operation.id) ?? [];

        const pipeline = await serviceBindings.db.transaction(
          async (tx) => {
            const transactionalPipelinesService = createPipelinesService(
              tx as unknown as DbConnection,
            );
            const transactionalRoutinesDao = createRoutinesDao(tx as unknown as DbConnection);
            const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
            const transactionalConversationMessagesDao = createConversationMessagesDao(tx);
            (0, serviceBindings.assertActivityActive)(sessionId, activity);
            if (generated.pendingOperations && generated.pendingOperations.length > 0) {
              const createPendingResult =
                await transactionalPipelinesService.createPendingOperations(
                  generated.pendingOperations,
                );
              if (createPendingResult.isErr()) throw createPendingResult.error;
              (0, serviceBindings.assertActivityActive)(sessionId, activity);
            }

            const createPipelineResult = await transactionalPipelinesService.create({
              id: crypto.randomUUID(),
              name: pipelineName,
              description: pipelineDescription,
              tags: ["agent-generated"],
              timeoutMs: null,
              nodes: generated.nodes,
              edges: generated.edges,
            });
            if (createPipelineResult.isErr()) throw createPipelineResult.error;
            const createdPipeline = createPipelineResult.value;
            (0, serviceBindings.assertActivityActive)(sessionId, activity);
            if (generateProposal.schedule) {
              const enabled = generateProposal.schedule.enabled;
              const nextRunAt = enabled
                ? getNextCronRunAt(generateProposal.schedule.cronExpression, new Date())
                : null;
              if (enabled && !nextRunAt) {
                throw new Error("Agent returned an invalid Pipeline schedule");
              }
              await transactionalRoutinesDao.create({
                id: crypto.randomUUID(),
                pipelineId: createdPipeline.id,
                name: generateProposal.schedule.name ?? `${pipelineName} schedule`,
                description: `Agent-created schedule for ${pipelineName}`,
                cronExpression: generateProposal.schedule.cronExpression,
                inputConfig: null,
                enabled,
                lastRunAt: null,
                nextRunAt,
              });
              (0, serviceBindings.assertActivityActive)(sessionId, activity);
            }
            const visibleMessages = messages.filter(
              (message) => message.role !== "system" && message.content.trim().length > 0,
            );
            for (const message of visibleMessages) {
              await transactionalConversationMessagesDao.create({
                id: crypto.randomUUID(),
                pipelineId: createdPipeline.id,
                role: message.role === "assistant" ? "agent" : "user",
                content: message.content,
                metadata: null,
                phase: "done",
                createdAt: message.createdAt,
              });
            }
            const lastVisibleMessage = visibleMessages.at(-1);
            if (
              lastVisibleMessage?.role !== "assistant" ||
              lastVisibleMessage.content.trim() !== generateProposal.purpose.trim()
            ) {
              await transactionalConversationMessagesDao.create({
                id: crypto.randomUUID(),
                pipelineId: createdPipeline.id,
                role: "agent",
                content: generateProposal.purpose,
                metadata: null,
                phase: "done",
              });
            }
            (0, serviceBindings.assertActivityActive)(sessionId, activity);
            await transactionalSessionsDao.update(sessionId, {
              status: "completed",
              createdPipelineId: createdPipeline.id,
            });
            (0, serviceBindings.assertActivityActive)(sessionId, activity);

            return createdPipeline;
          },
          { isolationLevel: "serializable" },
        );
        persistedPipeline.id = pipeline.id;
        (0, serviceBindings.assertActivityActive)(sessionId, activity);

        return pipeline;
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (generationResult.isErr()) {
      if (isCancellationError(generationResult.error) && persistedPipeline.id) {
        await ResultAsync.fromPromise(
          Promise.all([
            serviceBindings.pipelinesService.delete(persistedPipeline.id),
            ...pendingOperationIds.value.map((operationId) =>
              serviceBindings.operationsDao.delete(operationId),
            ),
          ]),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
      }
      await serviceBindings.proposalsDao.update(proposalRecord.id, {
        status: "proposal_ready",
        approvedAt: null,
      });
      await serviceBindings.sessionsDao.update(sessionId, {
        status: "proposal_ready",
        latestProposalId: proposalRecord.id,
        approvedProposalId: null,
        createdPipelineId: null,
      });
      input?.signal?.removeEventListener("abort", handleExternalAbort);
      (0, serviceBindings.finishActivity)(sessionId, activity);
      throw generationResult.error;
    }

    const pipeline = generationResult.value;
    input?.signal?.removeEventListener("abort", handleExternalAbort);
    (0, serviceBindings.finishActivity)(sessionId, activity);

    return { pipeline };
  };
