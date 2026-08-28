import { Result } from "neverthrow";
import {
  AgentRunEventEnvelopeSchema,
  encodeAgentRunEventCursor,
  type AgentRunEventEnvelope,
  type RuntimeTerminalStatus,
} from "@repo/schemas";
import type { PlatformCapabilities } from "../platform";

export type AgentRunEventsTransport = Pick<PlatformCapabilities, "apiBaseUrl" | "request">;

const parseJson = (raw: string): unknown =>
  Result.fromThrowable(
    () => JSON.parse(raw) as unknown,
    () => null,
  )().unwrapOr(null);

export const parseAgentRunSseMessage = (message: string): AgentRunEventEnvelope | null => {
  const data = message
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  const envelope = AgentRunEventEnvelopeSchema.safeParse(parseJson(data));

  return envelope.success ? envelope.data : null;
};

export const consumeAgentRunEventStream = async (
  platform: AgentRunEventsTransport,
  input: {
    runId: string;
    after?: number;
    signal?: AbortSignal;
    onEnvelope: (envelope: AgentRunEventEnvelope) => Promise<void> | void;
  },
): Promise<{ lastSequence: number; terminalStatus: RuntimeTerminalStatus | null }> => {
  const state = {
    buffer: "",
    lastSequence: input.after ?? 0,
    terminalStatus: null as RuntimeTerminalStatus | null,
  };
  const initialCursor = encodeAgentRunEventCursor(input.runId, state.lastSequence);
  const response = await platform.request(
    `${platform.apiBaseUrl}/agent-runs/${encodeURIComponent(input.runId)}/events?after=${encodeURIComponent(initialCursor)}`,
    {
      headers: {
        accept: "text/event-stream",
        ...(state.lastSequence > 0 ? { "Last-Event-ID": initialCursor } : {}),
      },
      signal: input.signal,
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Agent run event stream failed with status ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error(`Agent run ${input.runId} did not return an event stream`);

  const emitBufferedMessages = async () => {
    const messages = state.buffer.split(/\r?\n\r?\n/);
    state.buffer = messages.pop() ?? "";
    for (const message of messages) {
      const envelope = parseAgentRunSseMessage(message);
      if (!envelope || envelope.sequence <= state.lastSequence) continue;
      state.lastSequence = envelope.sequence;
      await input.onEnvelope(envelope);
      if (envelope.event.type === "terminal") {
        state.terminalStatus = envelope.event.status;
      }
    }
  };

  const decoder = new TextDecoder();
  while (!input.signal?.aborted) {
    const chunk = await reader.read();
    if (chunk.done) {
      state.buffer += decoder.decode();
      await emitBufferedMessages();
      const trailing = state.buffer.trim();
      if (trailing) {
        state.buffer = `${trailing}\n\n`;
        await emitBufferedMessages();
      }
      break;
    }
    state.buffer += decoder.decode(chunk.value, { stream: true });
    await emitBufferedMessages();
  }

  return { lastSequence: state.lastSequence, terminalStatus: state.terminalStatus };
};
