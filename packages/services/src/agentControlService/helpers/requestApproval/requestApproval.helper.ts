import { randomUUID } from "node:crypto";

import type { findAgentControlTool } from "@repo/agent-control";

import {
  AgentControlToolResultSchema,
  type AgentControlToolResult,
  type AgentResourceRef,
} from "@repo/schemas";

import { APPROVAL_TTL_MS, type AgentControlServiceBindings } from "../../contracts";

import { failureResult } from "../failureResult";
import { digestAgentControlArguments } from "../digestAgentControlArguments";
import { callIdFrom } from "../callIdFrom";

export const createRequestApprovalHelper =
  (serviceBindings: Pick<AgentControlServiceBindings, "repository" | "emit">) =>
  async ({
    actionId,
    definition,
    input,
    threadId,
    runId,
    target,
    redactedInput,
    reasons,
  }: {
    actionId: string;
    definition: NonNullable<ReturnType<typeof findAgentControlTool>>;
    input: unknown;
    threadId: string;
    runId: string | null;
    target: AgentResourceRef | null;
    redactedInput: Record<string, unknown>;
    reasons: string[];
  }): Promise<AgentControlToolResult> => {
    const callId = callIdFrom(input)!;
    const argumentDigest = digestAgentControlArguments(input);
    const approvalId = randomUUID();
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
    const summary =
      reasons.length > 0
        ? `Approval required: ${reasons.join("; ")}`
        : `Approval required before ${definition.title}.`;
    const requestedResult = AgentControlToolResultSchema.parse({
      actionId,
      status: "approval_required",
      resources: target ? [target] : [],
      summary,
      warnings: [],
      approvalRequestId: approvalId,
      data: { expiresAt: expiresAt.toISOString() },
    });
    const resourceVersion =
      input && typeof input === "object" && !Array.isArray(input)
        ? ((input as Record<string, unknown>).expectedVersion as number | undefined)
        : undefined;
    const persisted = await serviceBindings.repository.requestApproval({
      action: {
        id: actionId,
        threadId,
        runId,
        changeSetId: null,
        toolName: definition.name,
        risk: definition.risk,
        status: "approval_required",
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        redactedInput,
        result: requestedResult,
        forwardAction: null,
        inverseActions: null,
        idempotencyKey: callId,
        argumentDigest,
        completedAt: null,
      },
      approval: {
        id: approvalId,
        threadId,
        runId,
        actionId,
        toolName: definition.name,
        callId,
        argumentDigest,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        resourceVersion: resourceVersion ?? null,
        status: "pending",
        expiresAt,
        approvedAt: null,
        consumedAt: null,
      },
    });
    if (persisted.approval.argumentDigest !== argumentDigest) {
      return failureResult({
        actionId: persisted.action.id,
        error: {
          code: "IDEMPOTENCY_ARGUMENT_MISMATCH",
          message: "callId was already used with different arguments; retry with a new callId.",
          retryable: false,
          field: "callId",
        },
        resources: target ? [target] : [],
      });
    }
    const result = AgentControlToolResultSchema.parse({
      actionId: persisted.action.id,
      status: "approval_required",
      resources: target ? [target] : [],
      summary,
      warnings: [],
      approvalRequestId: persisted.approval.id,
      data: { expiresAt: persisted.approval.expiresAt.toISOString() },
    });
    if (persisted.created) {
      await (0, serviceBindings.emit)(runId, {
        type: "action_started",
        actionId: persisted.action.id,
        toolName: definition.name,
        risk: definition.risk,
        target,
        summary: `Checking approval for ${definition.title}.`,
      });
      await (0, serviceBindings.emit)(runId, {
        type: "approval_required",
        actionId: persisted.action.id,
        approvalRequestId: persisted.approval.id,
        toolName: definition.name,
        target,
        expiresAt: persisted.approval.expiresAt.toISOString(),
        summary,
      });
    }

    return result;
  };
