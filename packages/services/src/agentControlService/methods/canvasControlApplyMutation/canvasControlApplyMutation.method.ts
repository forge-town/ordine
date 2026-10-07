import { randomUUID } from "node:crypto";

import { applyPipelineActions } from "@repo/pipeline-engine";
import {
  AgentControlToolResultSchema,
  type AgentControlRisk,
  type PipelineGraphSnapshot,
} from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import type {
  CanvasMutationToolName,
  CanvasMutationInput,
  CanvasControlBindings,
} from "../../contracts";
import type { CanvasControlError, CanvasMutationValue } from "../../helpers/canvasControl";
import { canvasError } from "../../helpers/canvasControlCanvasError";
import { parseStoredResult } from "../../helpers/canvasControlParseStoredResult";
import { changeSetInput } from "../../helpers/canvasControlChangeSetInput";
import { validateInvocationBinding } from "../../helpers/canvasControlValidateInvocationBinding";
import { buildMutation } from "../../helpers/canvasControlBuildMutation";

export const createCanvasControlApplyMutationMethod = (
  serviceBindings: Pick<
    CanvasControlBindings,
    | "actionsDao"
    | "digestArguments"
    | "changeSetsDao"
    | "pipelinesDao"
    | "repository"
    | "validateOperationReferences"
  >,
) =>
  ({
    async applyMutation({
      toolName,
      input,
      threadId,
      runId,
      risk,
      redactedInput,
      argumentDigest,
      onStarted,
    }: {
      toolName: CanvasMutationToolName;
      input: CanvasMutationInput;
      threadId: string;
      runId: string | null;
      risk: AgentControlRisk;
      redactedInput: Record<string, unknown>;
      argumentDigest: string;
      onStarted?: (actionId: string) => Promise<void>;
    }): Promise<Result<CanvasMutationValue, CanvasControlError>> {
      const candidateActionId = randomUUID();
      const binding = validateInvocationBinding({
        input,
        threadId,
        runId,
        actionId: candidateActionId,
      });
      if (binding.isErr()) return err(binding.error);
      const metadata = changeSetInput(input);
      const existing = await serviceBindings.actionsDao.findByIdempotency(
        threadId,
        toolName,
        metadata.callId,
      );
      if (existing) {
        const persistedDigest =
          existing.argumentDigest ?? (0, serviceBindings.digestArguments)(existing.redactedInput);
        if (persistedDigest !== argumentDigest) {
          return err(
            canvasError(
              existing.id,
              "IDEMPOTENCY_ARGUMENT_MISMATCH",
              "callId was already used with different Canvas arguments; retry with a new callId.",
              false,
              { field: "callId" },
            ),
          );
        }
        const stored = parseStoredResult(existing.id, existing.status, existing.result);
        const storedAction = existing.changeSetId
          ? await serviceBindings.changeSetsDao.findById(existing.changeSetId)
          : null;

        if (!existing.forwardAction) {
          return err(
            canvasError(
              existing.id,
              "ACTION_REPLAY_UNAVAILABLE",
              "The stored Canvas action predates replay support; inspect the Canvas and retry with a new callId.",
              true,
              { field: "callId" },
            ),
          );
        }

        return storedAction && storedAction.targetId === metadata.pipelineId
          ? ok({
              actionId: existing.id,
              changeSetId: storedAction.id,
              pipelineId: metadata.pipelineId,
              pipelineAction: existing.forwardAction,
              result: stored,
              replayed: true,
            })
          : err(
              canvasError(
                existing.id,
                "IDEMPOTENCY_TARGET_MISMATCH",
                "callId was already used for another Canvas target.",
                false,
                { field: "callId" },
              ),
            );
      }
      const pipeline = await serviceBindings.pipelinesDao.findById(metadata.pipelineId);
      if (!pipeline) {
        return err(
          canvasError(
            candidateActionId,
            "PIPELINE_NOT_FOUND",
            `Pipeline "${metadata.pipelineId}" was not found.`,
          ),
        );
      }
      const requested = metadata.changeSetId
        ? await serviceBindings.changeSetsDao.findById(metadata.changeSetId)
        : await serviceBindings.changeSetsDao.findActive(threadId, "pipeline", metadata.pipelineId);
      if (
        requested &&
        (requested.threadId !== threadId ||
          requested.targetType !== "pipeline" ||
          requested.targetId !== metadata.pipelineId)
      ) {
        return err(
          canvasError(
            candidateActionId,
            "CHANGE_SET_BINDING_MISMATCH",
            "The Change Set does not belong to this thread and Pipeline.",
            false,
            { field: "changeSetId" },
          ),
        );
      }
      const baseSnapshot = {
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      } satisfies PipelineGraphSnapshot;
      const changeSet =
        requested ??
        (await serviceBindings.repository.createChangeSet({
          id: randomUUID(),
          threadId,
          runId,
          actor: "local-owner",
          kind: "agent-edit",
          originChangeSetId: null,
          targetType: "pipeline",
          targetId: pipeline.id,
          baseVersion: pipeline.version,
          revision: 0,
          appliedVersion: null,
          status: "drafting",
          baseSnapshot,
          draftSnapshot: baseSnapshot,
          committedAt: null,
        }));
      if (changeSet.status !== "drafting") {
        return err(
          canvasError(
            candidateActionId,
            "CHANGE_SET_NOT_DRAFTING",
            `Change Set ${changeSet.id} is ${changeSet.status}; Apply or Reject it before more edits.`,
            true,
            { field: "changeSetId" },
          ),
        );
      }
      if (pipeline.version !== changeSet.baseVersion) {
        return err(
          canvasError(
            candidateActionId,
            "VERSION_CONFLICT",
            `Pipeline version is ${pipeline.version}, but the draft is based on ${changeSet.baseVersion}.`,
            true,
            { field: "pipelineId" },
          ),
        );
      }
      const actionId = candidateActionId;
      const persistedAction = await serviceBindings.actionsDao.createIdempotent({
        id: actionId,
        threadId,
        runId,
        changeSetId: changeSet.id,
        toolName,
        risk,
        status: "started",
        targetType: "pipeline",
        targetId: pipeline.id,
        redactedInput,
        result: null,
        forwardAction: null,
        inverseActions: null,
        idempotencyKey: metadata.callId,
        argumentDigest,
        completedAt: null,
      });
      if (!persistedAction.created) {
        const persistedDigest =
          persistedAction.action.argumentDigest ??
          (0, serviceBindings.digestArguments)(persistedAction.action.redactedInput);
        if (persistedDigest !== argumentDigest) {
          return err(
            canvasError(
              persistedAction.action.id,
              "IDEMPOTENCY_ARGUMENT_MISMATCH",
              "callId was already used with different Canvas arguments; retry with a new callId.",
              false,
              { field: "callId" },
            ),
          );
        }
        const replayedChangeSet = persistedAction.action.changeSetId
          ? await serviceBindings.changeSetsDao.findById(persistedAction.action.changeSetId)
          : null;
        if (
          !replayedChangeSet ||
          replayedChangeSet.targetId !== metadata.pipelineId ||
          !persistedAction.action.forwardAction
        ) {
          return err(
            canvasError(
              persistedAction.action.id,
              "ACTION_IN_PROGRESS",
              "The matching Canvas call is already in progress; retry after it settles.",
              true,
              { field: "callId" },
            ),
          );
        }

        return ok({
          actionId: persistedAction.action.id,
          changeSetId: replayedChangeSet.id,
          pipelineId: metadata.pipelineId,
          pipelineAction: persistedAction.action.forwardAction,
          result: parseStoredResult(
            persistedAction.action.id,
            persistedAction.action.status,
            persistedAction.action.result,
          ),
          replayed: true,
        });
      }
      await onStarted?.(actionId);
      const currentSnapshot = changeSet.draftSnapshot ?? baseSnapshot;
      const mutation = buildMutation(toolName, input, currentSnapshot, actionId);
      if (mutation.isErr()) {
        await serviceBindings.actionsDao.update(actionId, {
          status: "failed",
          result: { error: mutation.error },
          completedAt: new Date(),
        });

        return err(mutation.error);
      }
      const applied = applyPipelineActions(currentSnapshot, [mutation.value.action]);
      if (applied.isErr()) {
        const diagnostic = applied.error[0]!;
        const failure = canvasError(actionId, diagnostic.code, diagnostic.message, true);
        await serviceBindings.actionsDao.update(actionId, {
          status: "failed",
          result: { error: failure },
          completedAt: new Date(),
        });

        return err(failure);
      }
      const operationValidation = await (0, serviceBindings.validateOperationReferences)(
        applied.value,
        actionId,
      );
      if (operationValidation.isErr()) {
        await serviceBindings.actionsDao.update(actionId, {
          status: "failed",
          result: { error: operationValidation.error },
          completedAt: new Date(),
        });

        return err(operationValidation.error);
      }
      const result = AgentControlToolResultSchema.parse({
        actionId,
        status: "succeeded",
        resources: [{ type: "pipeline", id: pipeline.id, label: pipeline.name }],
        summary: `${toolName} updated Change Set ${changeSet.id} at revision ${changeSet.revision + 1}.`,
        warnings: [],
        data: {
          changeSetId: changeSet.id,
          baseVersion: changeSet.baseVersion,
          revision: changeSet.revision + 1,
        },
      });
      const appended = await serviceBindings.repository.appendDraftAction({
        changeSetId: changeSet.id,
        expectedRevision: changeSet.revision,
        draftSnapshot: applied.value,
        actionId,
        result,
        forwardAction: mutation.value.action,
        inverseActions: mutation.value.inverse,
      });
      if (appended.type !== "applied") {
        const failure = canvasError(
          actionId,
          appended.type === "revision_conflict"
            ? "CHANGE_SET_REVISION_CONFLICT"
            : "CHANGE_SET_LOST",
          appended.type === "revision_conflict"
            ? "Another Canvas action changed this draft first; inspect the Canvas and retry with a new callId."
            : "The Change Set disappeared while applying this action.",
          true,
          { field: "callId" },
        );
        await serviceBindings.actionsDao.update(actionId, {
          status: "failed",
          result: { error: failure },
          completedAt: new Date(),
        });

        return err(failure);
      }

      return ok({
        actionId,
        changeSetId: changeSet.id,
        pipelineId: pipeline.id,
        pipelineAction: mutation.value.action,
        result,
        replayed: false,
      });
    },
  }).applyMutation;
