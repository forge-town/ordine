export const truncateNodeStrings = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => truncateNodeStrings(item, depth + 1));
  if (!value || typeof value !== "object" || depth > 5) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, truncateNodeStrings(child, depth + 1)]),
  );
};
