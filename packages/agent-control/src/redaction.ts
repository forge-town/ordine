import type { AgentControlToolDefinition } from "./toolCatalog";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /(?:api[-_]?key|authorization|bearer|credential|password|private[-_]?key|secret|token)/i;

const redactKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redactKeys(child),
    ]),
  );
};

const setPath = (value: unknown, path: string): void => {
  if (!value || typeof value !== "object") return;
  const segments = path.split(".");
  const current = segments.slice(0, -1).reduce<Record<string, unknown> | null>(
    (record, segment) => {
      const child = record?.[segment];

      return child && typeof child === "object" && !Array.isArray(child)
        ? (child as Record<string, unknown>)
        : null;
    },
    value as Record<string, unknown>,
  );
  if (!current) return;
  const leaf = segments.at(-1);
  if (leaf && leaf in current) current[leaf] = REDACTED;
};

export const redactAgentControlInput = (
  definition: AgentControlToolDefinition,
  input: unknown,
): Record<string, unknown> => {
  const redacted = redactKeys(structuredClone(input));
  const record =
    redacted && typeof redacted === "object" && !Array.isArray(redacted)
      ? (redacted as Record<string, unknown>)
      : { value: redacted };
  for (const path of definition.redactedInputPaths) setPath(record, path);

  return record;
};

export const redactAgentControlResult = (value: unknown): unknown => redactKeys(value);
