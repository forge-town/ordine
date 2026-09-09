export class ExecutionIntegrityError extends Error {
  readonly code = "EXECUTION_INTEGRITY_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "ExecutionIntegrityError";
  }
}
export class ExecutionRevisionConflictError extends Error {
  readonly code = "REVISION_CONFLICT";
  constructor(resource: string) {
    super(`Revision conflict for ${resource}`);
    this.name = "ExecutionRevisionConflictError";
  }
}
export class ExecutionIdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";
  constructor() {
    super("Request ID already belongs to different execution input");
    this.name = "ExecutionIdempotencyConflictError";
  }
}
export class ExecutionNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(resource: string) {
    super(`${resource} was not found in this execution identity`);
    this.name = "ExecutionNotFoundError";
  }
}
export class ExecutionApprovalExpiredError extends Error {
  readonly code = "APPROVAL_EXPIRED";
  constructor() {
    super("Approval is no longer valid");
    this.name = "ExecutionApprovalExpiredError";
  }
}
export class ExecutionDecisionConflictError extends Error {
  readonly code = "APPROVAL_DECISION_CONFLICT";
  constructor() {
    super("This request already has a different approval decision");
    this.name = "ExecutionDecisionConflictError";
  }
}
export class ExecutionScopeError extends Error {
  readonly code = "FORBIDDEN";
  constructor(scope: string) {
    super(`Missing execution scope: ${scope}`);
    this.name = "ExecutionScopeError";
  }
}
export class ExecutionCapacityError extends Error {
  readonly code = "EXECUTION_CAPACITY_EXCEEDED";
  readonly retryable = true;
  constructor() {
    super("Pending execution capacity is exhausted; retry after existing requests finish");
    this.name = "ExecutionCapacityError";
  }
}
