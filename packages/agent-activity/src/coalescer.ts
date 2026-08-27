/* eslint-disable ordine-vars/no-let */

import type { RuntimeEvent } from "@repo/schemas";

export const AGENT_ACTIVITY_DELTA_FLUSH_MS = 200;
export const AGENT_ACTIVITY_DELTA_MAX_FLUSH_MS = 1_000;
export const AGENT_ACTIVITY_DELTA_MAX_BYTES = 32 * 1024;

export type AgentRunEventEmitMeta = {
  coalesced: boolean;
  deltaCount: number;
};

export type AgentRunEventEmitter = (
  event: RuntimeEvent,
  meta: AgentRunEventEmitMeta,
) => Promise<void>;

const splitUtf8 = (value: string, maxBytes: number): string[] => {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  const encoder = new TextEncoder();
  for (const character of value) {
    const bytes = encoder.encode(character).byteLength;
    if (current && currentBytes + bytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += bytes;
  }
  if (current || value.length === 0) chunks.push(current);

  return chunks;
};

/**
 * Coalesces adjacent text deltas before they enter the durable Agent Run
 * event stream. Flushes happen at 200ms, at 32KiB, or at one second at the
 * latest. Non-text events always flush first so tool/phase/terminal ordering
 * remains observable and deterministic.
 */
export const createAgentRunEventCoalescer = (
  emit: AgentRunEventEmitter,
  options: {
    flushIntervalMs?: number;
    maxFlushIntervalMs?: number;
    maxBytes?: number;
  } = {},
) => {
  const flushIntervalMs = options.flushIntervalMs ?? AGENT_ACTIVITY_DELTA_FLUSH_MS;
  const maxFlushIntervalMs = options.maxFlushIntervalMs ?? AGENT_ACTIVITY_DELTA_MAX_FLUSH_MS;
  const maxBytes = options.maxBytes ?? AGENT_ACTIVITY_DELTA_MAX_BYTES;
  let pending: Extract<RuntimeEvent, { type: "text_delta" }> | undefined;
  let pendingBytes = 0;
  let pendingDeltaCount = 0;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let maxFlushTimer: ReturnType<typeof setTimeout> | undefined;
  let delivery = Promise.resolve();

  const queue = (event: RuntimeEvent, meta: AgentRunEventEmitMeta): Promise<void> => {
    const next = delivery.then(() => emit(event, meta));
    // Timer callbacks must never create an unhandled rejection. A caller that
    // explicitly awaits flush/push still receives the original rejection.
    delivery = next.catch(() => undefined);

    return next;
  };

  const clearTimers = (): void => {
    if (flushTimer) clearTimeout(flushTimer);
    if (maxFlushTimer) clearTimeout(maxFlushTimer);
    flushTimer = undefined;
    maxFlushTimer = undefined;
  };

  const flush = async (): Promise<void> => {
    clearTimers();
    const event = pending;
    const deltaCount = pendingDeltaCount;
    pending = undefined;
    pendingBytes = 0;
    pendingDeltaCount = 0;
    if (!event) {
      await delivery;

      return;
    }
    await queue(event, { coalesced: deltaCount > 1, deltaCount });
  };

  const schedule = (): void => {
    if (flushTimer || maxFlushTimer) return;
    flushTimer = setTimeout(() => void flush().catch(() => undefined), flushIntervalMs);
    maxFlushTimer = setTimeout(() => void flush().catch(() => undefined), maxFlushIntervalMs);
  };

  return {
    async push(event: RuntimeEvent): Promise<void> {
      if (event.type !== "text_delta") {
        await flush();
        await queue(event, { coalesced: false, deltaCount: 1 });

        return;
      }

      for (const text of splitUtf8(event.text, maxBytes)) {
        const bytes = new TextEncoder().encode(text).byteLength;
        if (pending && pending.runtime === event.runtime && pendingBytes + bytes <= maxBytes) {
          pending = { ...pending, text: `${pending.text}${text}`, timestamp: event.timestamp };
          pendingBytes += bytes;
          pendingDeltaCount += 1;
        } else {
          if (pending) await flush();
          pending = { ...event, text };
          pendingBytes = bytes;
          pendingDeltaCount = 1;
        }
        if (pendingBytes >= maxBytes) await flush();
        else schedule();
      }
    },
    flush,
    dispose: clearTimers,
  };
};
