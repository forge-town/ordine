export class PipelineNotFoundError extends Error {
  constructor(public readonly pipelineId: string) {
    super(`Pipeline ${pipelineId} not found`);
    this.name = "PipelineNotFoundError";
  }
}

export class ScriptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScriptExecutionError";
  }
}

export class ConfigParseError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly cause?: unknown,
  ) {
    super(`Could not parse config for operation ${operationName}`);
    this.name = "ConfigParseError";
  }
}

export class GitCloneError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitCloneError";
  }
}

/**
 * The run was stopped by a cancellation request at a node boundary. This is a
 * deliberate stop, not a failure — callers should finalize the run as
 * cancelled instead of failed.
 */
export class PipelineCancelledError extends Error {
  constructor(public readonly nodeId: string) {
    super(`Pipeline run cancelled before node ${nodeId}`);
    this.name = "PipelineCancelledError";
  }
}

export type PipelineRunError =
  | PipelineNotFoundError
  | ScriptExecutionError
  | ConfigParseError
  | GitCloneError
  | PipelineCancelledError;
