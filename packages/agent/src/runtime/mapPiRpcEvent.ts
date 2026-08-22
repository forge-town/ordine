import type { RuntimeEventPayload } from "./runtimeEventEmitter";

type UnknownRecord = Record<string, unknown>;

export type PiRpcEventState = {
  startedAt: number;
  sawVisibleOutput: boolean;
  thinking: boolean;
  textParts: string[];
  tools: Map<string, { name: string; completed: boolean }>;
};

export type PiRpcEventAction = { type: "continue" | "end" | "failed"; message?: string };

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asTokenCount = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

const stringify = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";

  return JSON.stringify(value);
};

const toolResultText = (result: unknown): string => {
  const value = asRecord(result);
  const content = value?.["content"];
  if (!Array.isArray(content)) return stringify(content);

  return content
    .map((item) => {
      const block = asRecord(item);

      return block?.["type"] === "text" ? stringify(block["text"]) : stringify(item);
    })
    .join("\n");
};

export const mapPiRpcEvent = (
  raw: UnknownRecord,
  state: PiRpcEventState,
  emit: (payload: RuntimeEventPayload) => unknown,
): PiRpcEventAction => {
  if (raw["type"] === "agent_start") {
    emit({ type: "status", phase: "running", message: "Pi agent started" });

    return { type: "continue" };
  }
  if (raw["type"] === "agent_end") return { type: "end" };
  if (raw["type"] === "turn_start") {
    emit({ type: "status", phase: "thinking", message: "Pi turn started" });

    return { type: "continue" };
  }
  if (raw["type"] === "turn_end") {
    const message = asRecord(raw["message"]);
    const usage = asRecord(message?.["usage"]);
    const cost = asRecord(usage?.["cost"]);
    if (usage) {
      emit({
        type: "usage",
        inputTokens: asTokenCount(usage["input"]),
        outputTokens: asTokenCount(usage["output"]),
        cachedInputTokens: asTokenCount(usage["cacheRead"]),
        costUsd:
          typeof cost?.["total"] === "number"
            ? cost["total"]
            : typeof cost?.["totalCost"] === "number"
              ? cost["totalCost"]
              : undefined,
      });
    }
    if (message?.["stopReason"] === "error") {
      return {
        type: "failed",
        message: asString(message["errorMessage"]) ?? "Pi agent turn failed",
      };
    }

    return { type: "continue" };
  }

  const assistantEvent = asRecord(raw["assistantMessageEvent"]);
  if (raw["type"] === "message_update" && assistantEvent) {
    if (assistantEvent["type"] === "text_delta") {
      const text = asString(assistantEvent["delta"]);
      if (text) {
        state.sawVisibleOutput = true;
        state.textParts.push(text);
        emit({ type: "status", phase: "streaming", message: "Pi is streaming" });
        emit({ type: "text_delta", text });
      }

      return { type: "continue" };
    }
    if (assistantEvent["type"] === "thinking_start") {
      if (!state.thinking) {
        state.thinking = true;
        emit({ type: "thinking", phase: "started" });
      }

      return { type: "continue" };
    }
    if (assistantEvent["type"] === "thinking_delta") {
      const text = asString(assistantEvent["delta"]);
      if (text) emit({ type: "thinking_delta", text });

      return { type: "continue" };
    }
    if (assistantEvent["type"] === "thinking_end") {
      if (state.thinking) {
        state.thinking = false;
        emit({ type: "thinking", phase: "completed" });
      }

      return { type: "continue" };
    }
    if (assistantEvent["type"] === "error") {
      return {
        type: "failed",
        message:
          asString(assistantEvent["reason"]) ??
          asString(assistantEvent["delta"]) ??
          "Pi agent error",
      };
    }
  }

  if (raw["type"] === "tool_execution_start") {
    const id = asString(raw["toolCallId"]);
    if (!id) return { type: "continue" };
    const name = asString(raw["toolName"]) ?? "tool";
    state.sawVisibleOutput = true;
    state.tools.set(id, { name, completed: false });
    emit({ type: "tool_start", id, name, input: raw["args"] });
    emit({ type: "tool_update", id, name, input: raw["args"], status: "in_progress" });

    return { type: "continue" };
  }
  if (raw["type"] === "tool_execution_end") {
    const id = asString(raw["toolCallId"]);
    if (!id) return { type: "continue" };
    const current = state.tools.get(id) ?? {
      name: asString(raw["toolName"]) ?? "tool",
      completed: false,
    };
    if (!state.tools.has(id)) {
      state.sawVisibleOutput = true;
      emit({ type: "tool_start", id, name: current.name });
    }
    const isError = raw["isError"] === true;
    const output = toolResultText(raw["result"]);
    current.completed = true;
    state.tools.set(id, current);
    emit({
      type: "tool_update",
      id,
      name: current.name,
      output,
      status: isError ? "failed" : "completed",
    });
    emit({ type: "tool_result", id, output, isError });

    return { type: "continue" };
  }
  if (raw["type"] === "compaction_start") {
    emit({ type: "context", phase: "compaction_started" });
    emit({ type: "status", phase: "compacting", message: "Pi is compacting context" });

    return { type: "continue" };
  }
  if (raw["type"] === "compaction_end") {
    emit({ type: "context", phase: "compaction_completed" });

    return { type: "continue" };
  }
  if (raw["type"] === "auto_retry_start") {
    emit({
      type: "retry",
      phase: "starting",
      attempt: asTokenCount(raw["attempt"]),
      message: asString(raw["error"]),
    });
    emit({ type: "status", phase: "retrying", message: "Pi is retrying" });

    return { type: "continue" };
  }
  if (raw["type"] === "auto_retry_end") {
    if (raw["success"] === false) {
      return {
        type: "failed",
        message: asString(raw["finalError"]) ?? "Pi auto-retry exhausted",
      };
    }
    emit({ type: "retry", phase: "succeeded", attempt: asTokenCount(raw["attempt"]) });

    return { type: "continue" };
  }
  if (raw["type"] === "extension_error") {
    return { type: "failed", message: asString(raw["error"]) ?? "Pi extension error" };
  }

  return { type: "continue" };
};
