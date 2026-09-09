import type {
  ExecutionJobRecord,
  executionArtifactsTable,
  executionEventsTable,
  executionNodeAttemptsTable,
} from "@repo/db-schema";
import type {
  ExecutionError,
  ExecutionNodeState,
  ExecutionPortValues,
  ExecutionTerminalJobState,
  ExecutionWarnings,
} from "@repo/schemas";

export type ExecutionIdentity = Pick<ExecutionJobRecord, "workspaceId" | "subjectId">;
export type ExecutionLease = Pick<
  ExecutionJobRecord,
  "workspaceId" | "subjectId" | "generation"
> & {
  jobId: ExecutionJobRecord["id"];
  executorId: NonNullable<ExecutionJobRecord["executorId"]>;
};
export type ExecutionAttemptStart = Pick<
  typeof executionNodeAttemptsTable.$inferInsert,
  "nodeId" | "attemptNumber"
> &
  Partial<
    Pick<
      typeof executionNodeAttemptsTable.$inferInsert,
      "id" | "iteration" | "inputs" | "agentRunId"
    >
  >;
export type ExecutionAttemptFinish = {
  state: Exclude<ExecutionNodeState, "queued" | "running" | "waiting_for_input">;
  outputs?: ExecutionPortValues;
  error?: ExecutionError;
  agentRunId?: string;
};
export type ExecutionJobFinish = {
  state: ExecutionTerminalJobState;
  outputs?: ExecutionPortValues;
  error?: ExecutionError;
  warnings?: ExecutionWarnings;
};
export type ExecutionEventAppend = Pick<
  typeof executionEventsTable.$inferInsert,
  "type" | "payload"
> &
  Partial<Pick<typeof executionEventsTable.$inferInsert, "nodeId" | "attemptId">>;
export type ExecutionArtifactRegistration = Pick<
  typeof executionArtifactsTable.$inferInsert,
  "metadata" | "storageKey"
>;
