import { z } from "zod/v4";

const AgentRunEventCursorPayloadSchema = z.object({
  v: z.literal(1),
  r: z.string().min(1),
  s: z.number().int().nonnegative().safe(),
});

export type AgentRunEventCursor = z.infer<typeof AgentRunEventCursorPayloadSchema>;

const toBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");

  return globalThis.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const fromBase64Url = (value: string): string => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);

  return new TextDecoder().decode(bytes);
};

/**
 * Encode the transport cursor without exposing the database sequence in the
 * URL or SSE Last-Event-ID header. The sequence remains an internal ordering
 * field in the event envelope and is never accepted as a public cursor.
 */
export const encodeAgentRunEventCursor = (runId: string, sequence: number): string =>
  toBase64Url(JSON.stringify({ v: 1, r: runId, s: sequence } satisfies AgentRunEventCursor));

/**
 * Decode and validate a transport cursor. Callers should additionally verify
 * that the cursor run id matches the run being requested.
 */
export const decodeAgentRunEventCursor = (cursor: string): AgentRunEventCursor =>
  AgentRunEventCursorPayloadSchema.parse(JSON.parse(fromBase64Url(cursor)) as unknown);
