export const normalizeForDigest = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) =>
          !["approvalRequestId", "callId", "changeSetId", "runId", "threadId"].includes(key),
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalizeForDigest(child)]),
  );
};
