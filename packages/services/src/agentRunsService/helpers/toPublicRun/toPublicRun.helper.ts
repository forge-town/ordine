import type { AgentRunRecord } from "@repo/db-schema";

import { AgentRunSchema, type AgentRun } from "@repo/schemas";

export const toPublicRun = (record: AgentRunRecord): AgentRun =>
  AgentRunSchema.parse({
    id: record.id,
    owner: { type: record.ownerType, id: record.ownerId },
    runtimeConfigId: record.runtimeConfigId,
    runtime: record.runtime,
    status: record.status,
    executablePath: record.executablePath,
    executableVersion: record.executableVersion,
    executableFingerprint: record.executableFingerprint,
    model: record.model,
    reasoningEffort: record.reasoningEffort,
    speed: record.speed,
    cwd: record.cwd,
    nativeSessionId: record.nativeSessionId,
    resumeFromRunId: record.resumeFromRunId,
    permissionMode: record.permissionMode,
    networkAccess: record.networkAccess,
    controlMode: record.controlMode,
    allowedTools: record.allowedTools,
    controlScopes: record.controlScopes,
    runtimeCapabilities: record.runtimeCapabilities ?? null,
    activitySnapshot: record.activitySnapshot ?? null,
    activityMetrics: record.activityMetrics ?? null,
    usage: record.usage,
    resultText: record.resultText,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    firstOutputAt: record.firstOutputAt?.toISOString() ?? null,
    lastActivityAt: record.lastActivityAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
  });
