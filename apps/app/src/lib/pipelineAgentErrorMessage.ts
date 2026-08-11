export interface PipelineAgentClientError extends Error {
  code?: string;
  status?: number;
}

type Translate = (key: string) => string;

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  ATTACHMENT_TOO_LARGE: "pipelineAgentErrors.attachmentTooLarge",
  INVALID_ATTACHMENT: "pipelineAgentErrors.invalidAttachment",
  INVALID_REQUEST: "pipelineAgentErrors.invalidRequest",
  PIPELINE_AGENT_ATTACHMENT_NOT_FOUND: "pipelineAgentErrors.attachmentNotFound",
  PIPELINE_AGENT_ATTACHMENT_STATE_CONFLICT: "pipelineAgentErrors.attachmentConflict",
  PIPELINE_AGENT_CANCELLED: "pipelineAgentErrors.cancelled",
  PIPELINE_AGENT_INVALID_STRUCTURE: "pipelineAgentErrors.invalidStructure",
  PIPELINE_AGENT_PROPOSAL_STATE_CONFLICT: "pipelineAgentErrors.proposalConflict",
  PIPELINE_AGENT_SESSION_NOT_FOUND: "pipelineAgentErrors.sessionNotFound",
};

export const getPipelineAgentErrorMessage = (
  error: Error,
  t: Translate,
  logError: (message: string, error: Error) => void = console.error,
) => {
  const clientError = error as PipelineAgentClientError;
  if (clientError.name === "AbortError" || clientError.code === "PIPELINE_AGENT_CANCELLED") {
    return t("pipelineAgentErrors.cancelled");
  }
  logError("Pipeline Agent request failed", error);
  if (clientError.code && ERROR_MESSAGE_KEYS[clientError.code]) {
    return t(ERROR_MESSAGE_KEYS[clientError.code]);
  }
  if (clientError.status === 404) {
    return t("pipelineAgentErrors.sessionNotFound");
  }
  if (clientError.status === 409) {
    return t("pipelineAgentErrors.stateConflict");
  }
  if (clientError instanceof TypeError || clientError.status === undefined) {
    return t("pipelineAgentErrors.network");
  }

  return t("pipelineAgentErrors.generic");
};
