export const createRuntimeModelMismatchError = (runtimeId: string, model: string) => {
  const error = new Error(
    `Configured model ${model} is not available for Agent runtime ${runtimeId}`,
  ) as Error & { code: string };
  error.code = "PIPELINE_AGENT_RUNTIME_MODEL_MISMATCH";

  return error;
};
