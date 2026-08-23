import { Result } from "neverthrow";
import { RuntimeEventSchema, type RuntimeEvent } from "@repo/schemas";

const MAX_EVENT_STRING_CHARS = 64 * 1024;
const MAX_EVENT_JSON_CHARS = 256 * 1024;
const SENSITIVE_KEY = /(?:authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|cookie)/i;
const CREDENTIAL_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  replacement: (match: string) => string;
}> = [
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: () => "Bearer [REDACTED]",
  },
  {
    pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/gi,
    replacement: () => "sk-[REDACTED]",
  },
  {
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gi,
    replacement: (match) => `${match.slice(0, match.indexOf("_") + 1)}[REDACTED]`,
  },
  {
    pattern:
      /\b(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret)\s*[:=]\s*([^\s,;]+)/gi,
    replacement: (match) => `${match.split(/[:=]/, 1)[0]?.trim()}=[REDACTED]`,
  },
];

export const redactSensitiveText = (value: string): string =>
  CREDENTIAL_PATTERNS.reduce(
    (redacted, { pattern, replacement }) => redacted.replace(pattern, replacement),
    value,
  );

const truncateString = (value: string): string => {
  const redacted = redactSensitiveText(value);
  if (redacted.length <= MAX_EVENT_STRING_CHARS) return redacted;

  return `${redacted.slice(0, MAX_EVENT_STRING_CHARS)}\n[truncated: output exceeded ${MAX_EVENT_STRING_CHARS} characters]`;
};

const sanitizeUnknown = (value: unknown, key = "", depth = 0): unknown => {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return truncateString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= 8) return "[truncated: maximum object depth exceeded]";
  if (Array.isArray(value)) {
    return value.slice(0, 500).map((entry) => sanitizeUnknown(entry, "", depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 500)
      .map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeUnknown(entryValue, entryKey, depth + 1),
      ]),
  );
};

const serialize = Result.fromThrowable(
  (value: unknown) => JSON.stringify(value),
  () => "",
);

export const sanitizeRuntimeEvent = (event: RuntimeEvent): RuntimeEvent => {
  const sanitized = sanitizeUnknown(event);
  const serialized = serialize(sanitized);
  const bounded =
    serialized.isOk() && serialized.value.length > MAX_EVENT_JSON_CHARS
      ? {
          ...event,
          type: "diagnostic" as const,
          level: "warning" as const,
          code: "EVENT_TRUNCATED",
          message: `Runtime event exceeded ${MAX_EVENT_JSON_CHARS} serialized characters and was truncated`,
          metadata: { originalType: event.type, reason: "serialized_size_limit" },
        }
      : sanitized;

  return RuntimeEventSchema.parse(bounded);
};
