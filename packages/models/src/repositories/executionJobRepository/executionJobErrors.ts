export class ExecutionLeaseLostError extends Error {
  readonly code = "EXECUTION_LEASE_LOST";
  constructor() {
    super("The executor no longer owns a valid Job lease");
    this.name = "ExecutionLeaseLostError";
  }
}
export class ExecutionJobStateConflictError extends Error {
  readonly code = "JOB_STATE_CONFLICT";
  constructor(message = "Job state does not permit this operation") {
    super(message);
    this.name = "ExecutionJobStateConflictError";
  }
}
export class ExecutionJobDeadlineError extends Error {
  readonly code = "JOB_DEADLINE_EXCEEDED";
  constructor() {
    super("The Job execution or waiting budget has expired");
    this.name = "ExecutionJobDeadlineError";
  }
}
