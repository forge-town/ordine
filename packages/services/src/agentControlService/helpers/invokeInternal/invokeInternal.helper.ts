import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import {
  findAgentControlTool,
  parseAgentControlToolInput,
  redactAgentControlInput,
  type AgentControlInvocationContext,
  type AgentControlToolName,
} from "@repo/agent-control";

import type { AgentControlToolResult } from "@repo/schemas";
import { ok, ResultAsync } from "neverthrow";

import {
  preparedRunTools,
  type InvocationState,
  type AgentControlServiceBindings,
} from "../../contracts";

import { failureResult } from "../failureResult";
import { successResult } from "../successResult";
import { replayResult } from "../replayResult";
import { digestAgentControlArguments } from "../digestAgentControlArguments";
import { idempotencyMismatchResult } from "../idempotencyMismatchResult";
import { callIdFrom } from "../callIdFrom";
import { approvalRequestIdFrom } from "../approvalRequestIdFrom";
import { targetFrom } from "../targetFrom";
import { navigationPath } from "../navigationPath";

export const createInvokeInternalHelper =
  (
    serviceBindings: Pick<
      AgentControlServiceBindings,
      | "ensureThread"
      | "serializeCanvasMutation"
      | "canvas"
      | "emit"
      | "actionsDao"
      | "options"
      | "executionPreflight"
      | "persistFailure"
      | "approvalsDao"
      | "repository"
      | "requestApproval"
      | "executeDomainTool"
    >,
  ) =>
  async (
    name: string,
    rawInput: unknown,
    context: AgentControlInvocationContext,
    invocation: InvocationState,
  ): Promise<AgentControlToolResult> => {
    const definition = findAgentControlTool(name);
    const fallbackActionId = randomUUID();
    if (!definition) {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Unknown Agent Control tool: ${name}`,
          retryable: false,
        },
      });
    }
    invocation.toolName = definition.name;
    invocation.runId = context.runId;
    if (!definition.audiences.includes(context.audience)) {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "AUDIENCE_DENIED",
          message: `${name} is not available to ${context.audience}.`,
          retryable: false,
        },
      });
    }
    if (context.readonly && definition.risk !== "read") {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "READONLY_DENIED",
          message: `${name} cannot run through a read-only endpoint.`,
          retryable: false,
        },
      });
    }
    const missingScope = definition.requiredScopes.find((scope) => !context.scopes.has(scope));
    if (missingScope) {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "SCOPE_DENIED",
          message: `${name} requires scope ${missingScope}.`,
          retryable: false,
        },
      });
    }
    const parsedResult = ResultAsync.fromPromise(
      Promise.resolve().then(() => parseAgentControlToolInput(name, rawInput)),
      (error) => error,
    );
    const parsed = await parsedResult;
    if (parsed.isErr()) {
      const zodError = parsed.error instanceof z.ZodError ? parsed.error : null;
      const issue = zodError?.issues[0];

      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "INVALID_TOOL_INPUT",
          message:
            issue?.message ??
            (parsed.error instanceof Error ? parsed.error.message : "Invalid tool input"),
          retryable: true,
          ...(issue?.path.length ? { field: issue.path.join(".") } : {}),
        },
      });
    }
    const input = parsed.value;
    const threadId = await (0, serviceBindings.ensureThread)(context);
    const runId = context.runId;
    const target = targetFrom(definition.name as AgentControlToolName, input);
    invocation.resources = target ? [target] : [];
    const redactedInput = redactAgentControlInput(definition, input);
    const callId = callIdFrom(input);
    const argumentDigest = digestAgentControlArguments(input);

    if (definition.risk === "draft" && definition.name !== "ordine.finish_canvas_edit") {
      const mutation = await (0, serviceBindings.serializeCanvasMutation)(
        `${threadId}:${target?.id ?? "unknown-pipeline"}`,
        () =>
          serviceBindings.canvas.applyMutation({
            toolName: definition.name as Parameters<
              typeof serviceBindings.canvas.applyMutation
            >[0]["toolName"],
            input: input as Parameters<typeof serviceBindings.canvas.applyMutation>[0]["input"],
            threadId,
            runId,
            risk: definition.risk,
            redactedInput,
            argumentDigest,
            onStarted: (actionId) => {
              invocation.actionId = actionId;

              return (0, serviceBindings.emit)(runId, {
                type: "action_started",
                actionId,
                toolName: definition.name,
                risk: definition.risk,
                target,
                summary: definition.title,
              });
            },
          }),
      );
      if (mutation.isErr()) {
        if (await serviceBindings.actionsDao.findById(mutation.error.actionId)) {
          await (0, serviceBindings.emit)(runId, {
            type: "action_failed",
            actionId: mutation.error.actionId,
            toolName: definition.name,
            error: {
              retryable: mutation.error.retryable,
              code: mutation.error.code,
              message: mutation.error.message,
              ...(mutation.error.field ? { field: mutation.error.field } : {}),
              ...(mutation.error.nodeId ? { nodeId: mutation.error.nodeId } : {}),
              ...(mutation.error.portId ? { portId: mutation.error.portId } : {}),
            },
          });
        }

        return failureResult({
          actionId: mutation.error.actionId,
          error: mutation.error,
          resources: target ? [target] : [],
        });
      }
      if (!mutation.value.replayed) {
        await (0, serviceBindings.emit)(runId, {
          type: "draft_applied",
          actionId: mutation.value.actionId,
          changeSetId: mutation.value.changeSetId,
          pipelineId: mutation.value.pipelineId,
          action: mutation.value.pipelineAction,
        });
        await (0, serviceBindings.emit)(runId, {
          type: "action_succeeded",
          actionId: mutation.value.actionId,
          result: mutation.value.result,
        });
      }

      return mutation.value.result;
    }

    const existing = callId
      ? await serviceBindings.actionsDao.findByIdempotency(threadId, definition.name, callId)
      : null;
    if (existing) invocation.actionId = existing.id;
    const mismatch = existing
      ? idempotencyMismatchResult(existing, argumentDigest, target ? [target] : [])
      : null;
    if (mismatch) return mismatch;
    if (existing && existing.status !== "approval_required") return replayResult(existing);

    const preparedSubmission = preparedRunTools.has(definition.name);
    if (preparedSubmission && serviceBindings.options.execution?.submissionMode !== "prepared-run")
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "EXECUTION_UNAVAILABLE",
          message:
            "The prepared execution service is not connected. This request cannot use the old runner.",
          retryable: false,
        },
      });
    if (preparedSubmission && existing?.status === "approval_required")
      return failureResult({
        actionId: existing.id,
        error: {
          code: "EXECUTION_REQUEST_REQUIRED",
          message:
            "This old approval cannot authorize a prepared run. Submit a new request for review.",
          retryable: false,
        },
      });
    const preflightResult = preparedSubmission
      ? ok(null)
      : await (0, serviceBindings.executionPreflight)(
          definition.name as AgentControlToolName,
          input,
        );
    if (preflightResult.isErr()) {
      const actionId = existing?.id ?? randomUUID();
      if (!existing) {
        const persisted = await serviceBindings.actionsDao.createIdempotent({
          id: actionId,
          threadId,
          runId,
          changeSetId: null,
          toolName: definition.name,
          risk: definition.risk,
          status: "started",
          targetType: target?.type ?? null,
          targetId: target?.id ?? null,
          redactedInput,
          result: null,
          forwardAction: null,
          inverseActions: null,
          idempotencyKey: callId,
          argumentDigest,
          completedAt: null,
        });
        invocation.actionId = persisted.action.id;
        if (!persisted.created) {
          return (
            idempotencyMismatchResult(persisted.action, argumentDigest, target ? [target] : []) ??
            replayResult(persisted.action)
          );
        }
        await (0, serviceBindings.emit)(runId, {
          type: "action_started",
          actionId: persisted.action.id,
          toolName: definition.name,
          risk: definition.risk,
          target,
          summary: definition.title,
        });
      }

      return (0, serviceBindings.persistFailure)({
        actionId: invocation.actionId ?? actionId,
        toolName: definition.name,
        runId,
        error: preflightResult.error,
        resources: target ? [target] : [],
      });
    }
    const approvalReasons = preparedSubmission
      ? []
      : [
          ...(definition.risk === "irreversible" ? [`${definition.title} is irreversible`] : []),
          ...(preflightResult.value?.requiresApproval ? preflightResult.value.reasons : []),
        ];
    if (existing?.status === "approval_required") {
      const approval = await serviceBindings.approvalsDao.findByActionId(existing.id);
      const requestedApprovalId = approvalRequestIdFrom(input);
      if (!approval || requestedApprovalId !== approval.id) return replayResult(existing);
      if (approval.argumentDigest !== digestAgentControlArguments(input)) {
        return (0, serviceBindings.persistFailure)({
          actionId: existing.id,
          toolName: definition.name,
          runId,
          error: {
            code: "APPROVAL_ARGUMENT_MISMATCH",
            message:
              "Approved arguments differ from this retry; submit a new callId for changed arguments.",
            retryable: false,
            field: "approvalRequestId",
          },
          resources: target ? [target] : [],
        });
      }
      const consumed = await serviceBindings.repository.consumeApproval({
        approvalId: approval.id,
        actionId: existing.id,
        callId: callId!,
        argumentDigest: approval.argumentDigest,
        now: new Date(),
      });
      if (!consumed) {
        const state = await serviceBindings.approvalsDao.findById(approval.id);

        return state?.status === "pending"
          ? replayResult(existing)
          : (0, serviceBindings.persistFailure)({
              actionId: existing.id,
              toolName: definition.name,
              runId,
              error: {
                code: "APPROVAL_NOT_CONSUMABLE",
                message: `Approval ${approval.id} is ${state?.status ?? "missing"} or expired.`,
                retryable: state?.status === "expired",
                field: "approvalRequestId",
              },
              resources: target ? [target] : [],
            });
      }
      await (0, serviceBindings.emit)(runId, {
        type: "action_started",
        actionId: existing.id,
        toolName: definition.name,
        risk: definition.risk,
        target,
        summary: `${definition.title} approved for one execution.`,
      });
    } else if (approvalReasons.length > 0) {
      return (0, serviceBindings.requestApproval)({
        actionId: randomUUID(),
        definition,
        input,
        threadId,
        runId,
        target,
        redactedInput,
        reasons: approvalReasons,
      });
    }

    const actionId = existing?.id ?? randomUUID();
    if (!existing) {
      const persisted = await serviceBindings.actionsDao.createIdempotent({
        id: actionId,
        threadId,
        runId,
        changeSetId: null,
        toolName: definition.name,
        risk: definition.risk,
        status: "started",
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        redactedInput,
        result: null,
        forwardAction: null,
        inverseActions: null,
        idempotencyKey: callId,
        argumentDigest,
        completedAt: null,
      });
      invocation.actionId = persisted.action.id;
      if (!persisted.created) {
        return (
          idempotencyMismatchResult(persisted.action, argumentDigest, target ? [target] : []) ??
          replayResult(persisted.action)
        );
      }
      await (0, serviceBindings.emit)(runId, {
        type: "action_started",
        actionId: persisted.action.id,
        toolName: definition.name,
        risk: definition.risk,
        target,
        summary: definition.title,
      });
    }
    const persistedActionId = invocation.actionId ?? actionId;
    const domain = await (0, serviceBindings.executeDomainTool)(
      definition.name as AgentControlToolName,
      input,
      threadId,
      persistedActionId,
    );
    if (domain.isErr()) {
      return (0, serviceBindings.persistFailure)({
        actionId: persistedActionId,
        toolName: definition.name,
        runId,
        error: domain.error,
        resources: target ? [target] : [],
      });
    }
    const result = successResult(persistedActionId, domain.value);
    await serviceBindings.actionsDao.update(persistedActionId, {
      status: "succeeded",
      result,
      completedAt: new Date(),
    });
    if (definition.name === "ordine.finish_canvas_edit") {
      const data = domain.value.data;
      await (0, serviceBindings.emit)(runId, {
        type: "change_set_ready",
        changeSetId: String(data?.changeSetId),
        target: target!,
        baseVersion: Number(data?.baseVersion),
        actionCount: Number(data?.actionCount ?? 0),
        summary: domain.value.summary,
      });
    }
    await (0, serviceBindings.emit)(runId, {
      type: "action_succeeded",
      actionId: persistedActionId,
      result,
    });
    if (
      !preparedSubmission &&
      (definition.risk === "write" || definition.risk === "execute") &&
      result.resources[0]
    ) {
      const resource = result.resources.at(-1)!;
      await (0, serviceBindings.emit)(runId, {
        type: "navigation_requested",
        pathname: navigationPath(resource),
        resource,
        focusId: resource.id,
      });
    }

    return result;
  };
