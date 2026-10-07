export const createRuntimeNotFoundError = (runtimeId?: string) => {
  const error = new Error(
    runtimeId
      ? `Configured Agent runtime not found: ${runtimeId}`
      : "No Agent runtime is configured",
  ) as Error & { code: string };
  error.code = "PIPELINE_AGENT_RUNTIME_NOT_FOUND";

  return error;
};
