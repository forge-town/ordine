export const truncateValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => truncateValue(entry, depth + 1));
  }
  if (!value || typeof value !== "object" || depth >= 5) return value;

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 80)
      .map(([key, child]) => [key, truncateValue(child, depth + 1)]),
  );
};
