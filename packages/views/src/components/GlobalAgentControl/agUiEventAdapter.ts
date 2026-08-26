import type { AgentRunEventEnvelope } from "@repo/schemas";

type AgUiBaseEvent = {
  runId: string;
  timestamp: string;
  sourceSequence: number;
};

export type AgentControlAgUiEvent = AgUiBaseEvent &
  (
    | { type: "RUN_STARTED" }
    | { type: "RUN_FINISHED" }
    | { type: "RUN_ERROR"; message: string }
    | { type: "TEXT_MESSAGE_CONTENT"; messageId: string; delta: string }
    | { type: "TOOL_CALL_START"; toolCallId: string; toolCallName: string }
    | { type: "TOOL_CALL_RESULT"; toolCallId: string; content: string; isError: boolean }
    | { type: "TOOL_CALL_END"; toolCallId: string }
    | { type: "CUSTOM"; name: string; value: unknown }
  );

const withBase = (envelope: AgentRunEventEnvelope): AgUiBaseEvent => ({
  runId: envelope.runId,
  timestamp: envelope.event.timestamp,
  sourceSequence: envelope.sequence,
});

/**
 * Thin projection to AG-UI event vocabulary. ORDINE's sequenced envelope stays
 * authoritative and durable; this adapter only gives UI consumers a familiar
 * event shape without changing replay, approval, or Change Set semantics.
 */
export const adaptAgentControlEventToAgUi = (
  envelope: AgentRunEventEnvelope,
): AgentControlAgUiEvent[] => {
  const base = withBase(envelope);
  const event = envelope.event;

  if (event.type === "status" && event.phase === "starting") {
    return [{ ...base, type: "RUN_STARTED" }];
  }
  if (event.type === "terminal") {
    return event.status === "completed"
      ? [{ ...base, type: "RUN_FINISHED" }]
      : [
          {
            ...base,
            type: "RUN_ERROR",
            message: event.resultText || `Agent run ended with status ${event.status}`,
          },
        ];
  }
  if (event.type === "text_delta") {
    return [
      {
        ...base,
        type: "TEXT_MESSAGE_CONTENT",
        messageId: envelope.runId,
        delta: event.text,
      },
    ];
  }
  if (event.type === "message") {
    return [
      {
        ...base,
        type: "TEXT_MESSAGE_CONTENT",
        messageId: envelope.runId,
        delta: event.text,
      },
    ];
  }
  if (event.type === "action_started") {
    return [
      {
        ...base,
        type: "TOOL_CALL_START",
        toolCallId: event.actionId,
        toolCallName: event.toolName,
      },
    ];
  }
  if (event.type === "action_succeeded") {
    return [
      {
        ...base,
        type: "TOOL_CALL_RESULT",
        toolCallId: event.actionId,
        content: event.result.summary,
        isError: false,
      },
      { ...base, type: "TOOL_CALL_END", toolCallId: event.actionId },
    ];
  }
  if (event.type === "action_failed") {
    return [
      {
        ...base,
        type: "TOOL_CALL_RESULT",
        toolCallId: event.actionId,
        content: event.error.message,
        isError: true,
      },
      { ...base, type: "TOOL_CALL_END", toolCallId: event.actionId },
    ];
  }
  if (event.type === "approval_required") {
    return [
      {
        ...base,
        type: "CUSTOM",
        name: "ordine.approval_required",
        value: event,
      },
    ];
  }
  if (
    event.type === "draft_applied" ||
    event.type === "change_set_ready" ||
    event.type === "change_set_committed" ||
    event.type === "change_set_rolled_back" ||
    event.type === "navigation_requested"
  ) {
    return [{ ...base, type: "CUSTOM", name: `ordine.${event.type}`, value: event }];
  }

  return [];
};
