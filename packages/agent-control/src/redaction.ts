import type { AgentControlToolDefinition } from "./toolCatalog";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /(?:api[-_]?key|authorization|bearer|credential|password|private[-_]?key|secret|token)/i;
const CREDENTIAL_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  replacement: (match: string) => string;
}> = [
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu,
    replacement: () => "Bearer [REDACTED]",
  },
  {
    pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/giu,
    replacement: () => "sk-[REDACTED]",
  },
  {
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/giu,
    replacement: (match) => `${match.slice(0, match.indexOf("_") + 1)}[REDACTED]`,
  },
  {
    pattern:
      /\b(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret)\s*[:=]\s*([^\s,;]+)/giu,
    replacement: (match) => `${match.split(/[:=]/u, 1)[0]?.trim()}=[REDACTED]`,
  },
];

const redactText = (value: string): string =>
  CREDENTIAL_PATTERNS.reduce(
    (redacted, { pattern, replacement }) => redacted.replace(pattern, replacement),
    value,
  );

const redactKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactKeys);
  if (typeof value === "string") return redactText(value);
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
