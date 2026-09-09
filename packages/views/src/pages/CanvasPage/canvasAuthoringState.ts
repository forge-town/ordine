/** Only transport status proves absence. Never inspect free-form error messages. */
export const canvasRequestStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const value = error as {
    statusCode?: unknown;
    status?: unknown;
    data?: { httpStatus?: unknown };
  };
  const status = value.statusCode ?? value.status ?? value.data?.httpStatus;

  return typeof status === "number" ? status : undefined;
};

export const isAuthoringPipelineMissing = (input: {
  error?: unknown;
  isSuccess?: boolean;
  result?: unknown;
  responseData?: unknown;
}): boolean =>
  input.error
    ? canvasRequestStatus(input.error) === 404
    : input.isSuccess === true && (input.result === null || input.responseData === null);
