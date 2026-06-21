export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v === "string" || typeof v === "number")) return value.join(", ");

    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);

  return String(value);
};

export const isComplexValue = (value: unknown): boolean => {
  if (Array.isArray(value) && value.some((v) => typeof v === "object" && v !== null)) return true;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return true;

  return false;
};
