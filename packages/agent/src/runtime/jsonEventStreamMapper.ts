import { Result } from "neverthrow";
import type { RuntimeEventPayload } from "./runtimeEventEmitter";

type UnknownRecord = Record<string, unknown>;

export type JsonEventStreamKind = "opencode" | "codex";

export type JsonEventStreamState = {
  kind: JsonEventStreamKind;
  parsedEventCount: number;
  sawVisibleOutput: boolean;
  textParts: string[];
  sessionId?: string;
  fatalMessage?: string;
  tools: Map<string, { name: string; completed: boolean }>;
  reasoningChars: Map<string, number>;
  thinking: boolean;
  emittedReasoning: boolean;
  previousCodexMessage: boolean;
  lastCodexMessageEndedWithNewline: boolean;
};

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asTokenCount = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

const parseJson = Result.fromThrowable(
  (line: string) => JSON.parse(line) as unknown,
  (error) => (error instanceof Error ? error.message : String(error)),
);

const parseEmbeddedJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const parsed = parseJson(value);

  return parsed.isOk() ? parsed.value : value;
};

const stringify = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";

  return JSON.stringify(value);
};

const errorMessage = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.length > 0) return value;
  const record = asRecord(value);

  return (
    asString(record?.["detail"]) ??
    asString(record?.["message"]) ??
    asString(record?.["error"]) ??
    fallback
  );
};

const openCodeToolStatus = (statePart: UnknownRecord): "in_progress" | "completed" | "failed" => {
  const status = asString(statePart["status"])?.toLowerCase() ?? "";
  if (["error", "failed"].includes(status)) return "failed";
  if (status === "completed") {
    const metadata = asRecord(statePart["metadata"]);
    const exitCode = statePart["exit"] ?? statePart["exitCode"] ?? metadata?.["exit"];
    if (typeof exitCode === "number" && exitCode !== 0) return "failed";
    if (statePart["error"]) return "failed";

    return "completed";
  }

  return "in_progress";
};

const handleOpenCodeEvent = (
  event: UnknownRecord,
  state: JsonEventStreamState,
  emit: (payload: RuntimeEventPayload) => unknown,
): void => {
  const part = asRecord(event["part"]) ?? {};
  if (event["type"] === "step_start") {
    const sessionId = asString(event["sessionID"]);
    if (sessionId && sessionId !== state.sessionId) {
      state.sessionId = sessionId;
      emit({ type: "session", phase: "captured", id: sessionId });
    }
    emit({ type: "status", phase: "running", message: "OpenCode step started" });

    return;
  }
  if (event["type"] === "text") {
    const text = asString(part["text"]);
    if (!text) return;
    state.sawVisibleOutput = true;
    state.textParts.push(text);
    emit({ type: "text_delta", text });

    return;
  }
  if (event["type"] === "tool_use") {
    const id = asString(part["callID"]);
    const name = asString(part["tool"]);
    if (!id || !name) return;
    const statePart = asRecord(part["state"]) ?? {};
    const existing = state.tools.get(id);
    if (!existing) {
      state.sawVisibleOutput = true;
      state.tools.set(id, { name, completed: false });
      emit({ type: "tool_start", id, name, input: parseEmbeddedJson(statePart["input"]) });
    }
    const status = openCodeToolStatus(statePart);
    emit({
      type: "tool_update",
      id,
      name,
      status,
      input: parseEmbeddedJson(statePart["input"]),
      output: statePart["output"] ?? statePart["error"],
    });
    if (status !== "in_progress" && !state.tools.get(id)?.completed) {
      const tool = state.tools.get(id);
      if (tool) tool.completed = true;
      emit({
        type: "tool_result",
        id,
        output: statePart["error"] ?? statePart["output"],
        isError: status === "failed",
      });
    }

    return;
  }
  if (event["type"] === "step_finish") {
    const tokens = asRecord(part["tokens"]);
    const cache = asRecord(tokens?.["cache"]);
    if (tokens) {
      emit({
        type: "usage",
        inputTokens: asTokenCount(tokens["input"]),
        outputTokens: asTokenCount(tokens["output"]),
        cachedInputTokens: asTokenCount(cache?.["read"]),
        costUsd: typeof part["cost"] === "number" ? part["cost"] : undefined,
      });
    }

    return;
  }
  if (event["type"] === "error") {
    state.fatalMessage = errorMessage(event["error"] ?? event["message"], "OpenCode error");
    emit({
      type: "diagnostic",
      level: "error",
      code: "OPENCODE_STREAM_ERROR",
      message: state.fatalMessage,
    });
  }
};

const emitCodexReasoning = (
  event: UnknownRecord,
  state: JsonEventStreamState,
  emit: (payload: RuntimeEventPayload) => unknown,
): boolean => {
  if (!["item.started", "item.updated", "item.completed"].includes(String(event["type"]))) {
    return false;
  }
  const item = asRecord(event["item"]);
  if (item?.["type"] !== "reasoning") return false;
  const id = asString(item["id"]) ?? "reasoning";
  const text = asString(item["text"]) ?? "";
  const emitted = state.reasoningChars.get(id) ?? 0;
  if (text.length > emitted) {
    if (!state.thinking) {
      state.thinking = true;
      emit({ type: "thinking", phase: "started" });
    }
    const suffix = text.slice(emitted);
    emit({
      type: "thinking_delta",
      text: emitted === 0 && state.emittedReasoning ? `\n\n${suffix}` : suffix,
    });
    state.reasoningChars.set(id, text.length);
    state.emittedReasoning = true;
  }
  if (event["type"] === "item.completed" && state.thinking) {
    state.thinking = false;
    emit({ type: "thinking", phase: "completed" });
  }

  return true;
};

const handleCodexEvent = (
  event: UnknownRecord,
  state: JsonEventStreamState,
  emit: (payload: RuntimeEventPayload) => unknown,
): void => {
  if (event["type"] === "error") {
    const message = errorMessage(event["message"] ?? event["error"], "Codex error");
    if (
      message.startsWith("Reconnecting...") &&
      (message.includes("timeout waiting for child process to exit") ||
        message.includes("stream disconnected before completion"))
    ) {
      emit({ type: "status", phase: "waiting", message });

      return;
    }
    state.fatalMessage = message;
    emit({ type: "diagnostic", level: "error", code: "CODEX_STREAM_ERROR", message });

    return;
  }
  if (event["type"] === "turn.failed") {
    state.fatalMessage = errorMessage(event["error"] ?? event["message"], "Codex turn failed");
    emit({
      type: "diagnostic",
      level: "error",
      code: "CODEX_TURN_FAILED",
      message: state.fatalMessage,
    });

    return;
  }
  if (event["type"] === "thread.started") {
    const sessionId = asString(event["thread_id"]);
    if (sessionId) {
      state.sessionId = sessionId;
      emit({ type: "session", phase: "captured", id: sessionId });
    }
    emit({ type: "status", phase: "initializing", message: "Codex thread started" });

    return;
  }
  if (event["type"] === "turn.started") {
    state.previousCodexMessage = false;
    state.lastCodexMessageEndedWithNewline = false;
    emit({ type: "status", phase: "thinking", message: "Codex turn started" });

    return;
  }
  if (emitCodexReasoning(event, state, emit)) return;

  const item = asRecord(event["item"]);
  if (event["type"] === "item.started" && item?.["type"] === "command_execution") {
    const id = asString(item["id"]);
    if (!id || state.tools.has(id)) return;
    state.sawVisibleOutput = true;
    state.tools.set(id, { name: "Bash", completed: false });
    emit({ type: "tool_start", id, name: "Bash", input: { command: item["command"] ?? "" } });
    emit({ type: "tool_update", id, name: "Bash", status: "in_progress" });

    return;
  }
  if (event["type"] === "item.completed" && item?.["type"] === "command_execution") {
    const id = asString(item["id"]);
    if (!id) return;
    if (!state.tools.has(id)) {
      state.sawVisibleOutput = true;
      state.tools.set(id, { name: "Bash", completed: false });
      emit({ type: "tool_start", id, name: "Bash", input: { command: item["command"] ?? "" } });
    }
    const isError =
      (typeof item["exit_code"] === "number" && item["exit_code"] !== 0) ||
      item["status"] === "failed";
    const output = stringify(item["aggregated_output"]);
    const tool = state.tools.get(id);
    if (tool) tool.completed = true;
    emit({
      type: "tool_update",
      id,
      name: "Bash",
      status: isError ? "failed" : "completed",
      output,
    });
    emit({ type: "tool_result", id, output, isError });

    return;
  }
  if (event["type"] === "item.completed" && item?.["type"] === "error") {
    const message = asString(item["message"]);
    if (message) {
      emit({ type: "diagnostic", level: "warning", code: "CODEX_ITEM_WARNING", message });
    }

    return;
  }
  if (event["type"] === "item.completed" && item?.["type"] === "agent_message") {
    const text = asString(item["text"]);
    if (!text) return;
    const needsBoundary =
      state.previousCodexMessage &&
      !state.lastCodexMessageEndedWithNewline &&
      !text.startsWith("\n");
    const message = needsBoundary ? `\n${text}` : text;
    state.sawVisibleOutput = true;
    state.textParts.push(message);
    state.previousCodexMessage = true;
    state.lastCodexMessageEndedWithNewline = text.endsWith("\n");
    emit({ type: "message", text: message });

    return;
  }
  if (event["type"] === "turn.completed") {
    const usage = asRecord(event["usage"]);
    if (usage) {
      emit({
        type: "usage",
        inputTokens: asTokenCount(usage["input_tokens"]),
        outputTokens: asTokenCount(usage["output_tokens"]),
        cachedInputTokens: asTokenCount(usage["cached_input_tokens"]),
      });
    }
  }
};

export const createJsonEventStreamState = (kind: JsonEventStreamKind): JsonEventStreamState => ({
  kind,
  parsedEventCount: 0,
  sawVisibleOutput: false,
  textParts: [],
  tools: new Map(),
  reasoningChars: new Map(),
  thinking: false,
  emittedReasoning: false,
  previousCodexMessage: false,
  lastCodexMessageEndedWithNewline: false,
});

export const handleJsonEventStreamLine = (
  line: string,
  state: JsonEventStreamState,
  emit: (payload: RuntimeEventPayload) => unknown,
): void => {
  const parsed = parseJson(line);
  if (parsed.isErr()) {
    emit({
      type: "diagnostic",
      level: "warning",
      code: "JSON_EVENT_STREAM_MALFORMED",
      message: parsed.error,
    });

    return;
  }
  const event = asRecord(parsed.value);
  if (!event) return;
  state.parsedEventCount += 1;
  if (state.kind === "opencode") {
    handleOpenCodeEvent(event, state, emit);
  } else {
    handleCodexEvent(event, state, emit);
  }
};
