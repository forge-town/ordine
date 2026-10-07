export const isCancellationError = (error: Error) =>
  (error as Error & { code?: string }).code === "PIPELINE_AGENT_CANCELLED";
