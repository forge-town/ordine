import { Result } from "neverthrow";
import {
  AgentRunEventSchema,
  RuntimeEventSchema,
  type AgentRunEvent,
  type RuntimeEvent,
} from "@repo/schemas";

const MAX_EVENT_STRING_BYTES = 64 * 1024;
const MAX_EVENT_JSON_BYTES = 256 * 1024;
const SENSITIVE_KEY =
  /(?:authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|cookie)/i;
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

const truncateUtf8 = (value: string, maxBytes: number, marker: string): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength <= maxBytes) return value;
  const markerBytes = encoder.encode(marker).byteLength;
  const budget = Math.max(0, maxBytes - markerBytes);
  const prefix = Array.from(value).reduce(
    (state, character) => {
      if (state.done) return state;
      const characterBytes = encoder.encode(character).byteLength;
      if (state.bytes + characterBytes > budget) return { ...state, done: true };

      return {
        text: `${state.text}${character}`,
        bytes: state.bytes + characterBytes,
        done: false,
      };
    },
    { text: "", bytes: 0, done: false },
  ).text;

  return `${prefix}${marker}`;
};

const truncateString = (value: string): string => {
  const redacted = redactSensitiveText(value);

  return truncateUtf8(
    redacted,
    MAX_EVENT_STRING_BYTES,
    `\n[truncated: output exceeded ${MAX_EVENT_STRING_BYTES} UTF-8 bytes]`,
  );
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
    serialized.isOk() &&
    new TextEncoder().encode(serialized.value).byteLength > MAX_EVENT_JSON_BYTES
      ? {
          runtime: event.runtime,
          timestamp: event.timestamp,
          type: "diagnostic" as const,
          level: "warning" as const,
          code: "EVENT_TRUNCATED",
          message: `Runtime event exceeded ${MAX_EVENT_JSON_BYTES} serialized UTF-8 bytes and was truncated`,
          metadata: { originalType: event.type, reason: "serialized_size_limit" },
        }
      : sanitized;

  return RuntimeEventSchema.parse(bounded);
};

export const sanitizeAgentRunEvent = (event: AgentRunEvent): AgentRunEvent => {
  const sanitized = sanitizeUnknown(event);
  const serialized = serialize(sanitized);
  const bounded =
    serialized.isOk() &&
    new TextEncoder().encode(serialized.value).byteLength > MAX_EVENT_JSON_BYTES
      ? {
          runtime: event.runtime,
          timestamp: event.timestamp,
          type: "diagnostic" as const,
          level: "warning" as const,
          code: "EVENT_TRUNCATED",
          message: `Agent Run event exceeded ${MAX_EVENT_JSON_BYTES} serialized UTF-8 bytes and was truncated`,
          metadata: { originalType: event.type, reason: "serialized_size_limit" },
        }
      : sanitized;

  return AgentRunEventSchema.parse(bounded);
};
