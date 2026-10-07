export const callIdFrom = (input: unknown): string | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const callId = (input as Record<string, unknown>).callId;

  return typeof callId === "string" ? callId : null;
};
