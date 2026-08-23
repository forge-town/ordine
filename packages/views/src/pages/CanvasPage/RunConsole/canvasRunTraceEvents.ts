import { Result } from "neverthrow";
import { RuntimeEventSchema, TRACE_MARKER, type RuntimeEvent } from "@repo/schemas";

export type CanvasRunTraceEvent =
  | { type: "node_start"; nodeId: string }
  | { type: "node_done"; nodeId: string }
  | { type: "node_fail"; nodeId: string }
  | { type: "llm_content"; nodeId: string; content: string }
  | { type: "agent_run"; nodeId: string; runId: string }
  | { type: "agent_event"; nodeId: string; event: RuntimeEvent };

const withoutTimestamp = (log: string): string => log.replace(/^\[[^\]]+\]\s*/, "");

const splitNodePayload = (value: string): { nodeId: string; payload: string } | null => {
  const separator = value.indexOf("::");
  if (separator < 1) return null;

  return {
    nodeId: value.slice(0, separator),
    payload: value.slice(separator + 2),
  };
};

export const parseCanvasRunTraceEvents = (logs: readonly string[]): CanvasRunTraceEvent[] => {
  const events: CanvasRunTraceEvent[] = [];
  for (const log of logs) {
    const message = withoutTimestamp(log);
    if (message.startsWith(TRACE_MARKER.nodeStart)) {
      events.push({ type: "node_start", nodeId: message.slice(TRACE_MARKER.nodeStart.length) });
      continue;
    }
    if (message.startsWith(TRACE_MARKER.nodeDone)) {
      events.push({ type: "node_done", nodeId: message.slice(TRACE_MARKER.nodeDone.length) });
      continue;
    }
    if (message.startsWith(TRACE_MARKER.nodeFail)) {
      events.push({ type: "node_fail", nodeId: message.slice(TRACE_MARKER.nodeFail.length) });
      continue;
    }
    if (message.startsWith(TRACE_MARKER.llmContent)) {
      const parsed = splitNodePayload(message.slice(TRACE_MARKER.llmContent.length));
      if (parsed) {
        events.push({ type: "llm_content", nodeId: parsed.nodeId, content: parsed.payload });
      }
      continue;
    }
    if (message.startsWith(TRACE_MARKER.agentRun)) {
      const parsed = splitNodePayload(message.slice(TRACE_MARKER.agentRun.length));
      if (parsed?.payload) {
        events.push({ type: "agent_run", nodeId: parsed.nodeId, runId: parsed.payload });
      }
      continue;
    }
    if (!message.startsWith(TRACE_MARKER.agentEvent)) continue;
    const parsed = splitNodePayload(message.slice(TRACE_MARKER.agentEvent.length));
    if (!parsed) continue;
    const payload = Result.fromThrowable(
      () => JSON.parse(parsed.payload) as unknown,
      () => null,
    )().unwrapOr(null);
    const runtimeEvent = RuntimeEventSchema.safeParse(payload);
    if (runtimeEvent.success) {
      events.push({ type: "agent_event", nodeId: parsed.nodeId, event: runtimeEvent.data });
    }
  }

  return events;
};
