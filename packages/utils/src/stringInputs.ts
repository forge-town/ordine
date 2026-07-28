/**
 * Picks only the string-valued entries from a config object. Used to prepare
 * routine input configs for pipeline runs while dropping non-string values
 * (numbers, booleans, nested objects, etc.).
 */
export const toStringInputs = (
  inputConfig: Record<string, unknown> | null,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(inputConfig ?? {}).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
