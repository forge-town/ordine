export const createCancellationError = (sessionId: string) => {
  const error = new Error(`Pipeline agent session cancelled: ${sessionId}`) as Error & {
    code: string;
  };
  error.code = "PIPELINE_AGENT_CANCELLED";

  return error;
};
