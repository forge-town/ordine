export const approvalRequestIdFrom = (input: unknown): string | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const approvalRequestId = (input as Record<string, unknown>).approvalRequestId;

  return typeof approvalRequestId === "string" ? approvalRequestId : null;
};
