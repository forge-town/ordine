import { Result } from "neverthrow";
import type { RuntimeEventPayload } from "../runtime/runtimeEventEmitter";
import type { ClaudeStreamEvent } from "./schemas/ClaudeStreamEventSchema";

type UnknownRecord = Record<string, unknown>;
type EmitRuntimeEvent = (payload: RuntimeEventPayload) => unknown;

type ClaudeRuntimeToolState = {
  name: string;
  completed: boolean;
  partialInput: string;
};

export type ClaudeRuntimeEventState = {
  sessionId?: string;
  sawTextDelta: boolean;
  thinkingBlocks: Set<number>;
  toolBlocks: Map<number, string>;
  tools: Map<string, ClaudeRuntimeToolState>;
};

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asIndex = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;

const parseJson = Result.fromThrowable(
  (value: string) => JSON.parse(value) as unknown,
  () => undefined,
);

const parsedToolInput = (value: string): unknown => {
  const parsed = parseJson(value);

  return parsed.isOk() ? parsed.value : { partialJson: value };
};

const startTool = ({
  state,
  emit,
  id,
  name,
  input,
}: {
  state: ClaudeRuntimeEventState;
  emit: EmitRuntimeEvent;
  id: string;
  name: string;
  input?: unknown;
}): ClaudeRuntimeToolState => {
  const existing = state.tools.get(id);
  if (existing) {
    if (input !== undefined) {
      emit({ type: "tool_update", id, name: existing.name, status: "in_progress", input });
    }

    return existing;
  }

  const tool = { name, completed: false, partialInput: "" };
  state.tools.set(id, tool);
  emit({ type: "tool_start", id, name, ...(input === undefined ? {} : { input }) });
  emit({
    type: "tool_update",
    id,
    name,
    status: "in_progress",
    ...(input === undefined ? {} : { input }),
  });

  return tool;
};

const mapStreamEvent = (
  event: ClaudeStreamEvent,
  state: ClaudeRuntimeEventState,
  emit: EmitRuntimeEvent,
): void => {
  const streamEvent = asRecord(event.event);
  const streamType = asString(streamEvent?.["type"]);
  const index = asIndex(streamEvent?.["index"]);
  const contentBlock = asRecord(streamEvent?.["content_block"]);

  if (streamType === "content_block_start" && index !== undefined) {
    const blockType = asString(contentBlock?.["type"]);
    if (blockType === "thinking") {
      state.thinkingBlocks.add(index);
      emit({ type: "thinking", phase: "started" });
      const thinking = asString(contentBlock?.["thinking"]);
      if (thinking) emit({ type: "thinking_delta", text: thinking });

      return;
    }
    if (blockType === "tool_use") {
      const id = asString(contentBlock?.["id"]);
      const name = asString(contentBlock?.["name"]);
      if (!id || !name) return;
      state.toolBlocks.set(index, id);
      startTool({ state, emit, id, name, input: contentBlock?.["input"] });
    }

    return;
  }

  if (streamType === "content_block_delta") {
    const delta = asRecord(streamEvent?.["delta"]);
    const deltaType = asString(delta?.["type"]);
    if (deltaType === "text_delta") {
      const text = asString(delta?.["text"]);
      if (!text) return;
      state.sawTextDelta = true;
      emit({ type: "text_delta", text });

      return;
    }
    if (deltaType === "thinking_delta") {
      const thinking = asString(delta?.["thinking"]);
      if (thinking) emit({ type: "thinking_delta", text: thinking });

      return;
    }
    if (deltaType === "input_json_delta" && index !== undefined) {
      const id = state.toolBlocks.get(index);
      const partialJson = asString(delta?.["partial_json"]);
      if (!id || !partialJson) return;
      const tool = state.tools.get(id);
      if (!tool) return;
      tool.partialInput += partialJson;
      emit({
        type: "tool_update",
        id,
        name: tool.name,
        status: "in_progress",
        input: parsedToolInput(tool.partialInput),
      });
    }

    return;
  }

  if (streamType !== "content_block_stop" || index === undefined) return;
  if (state.thinkingBlocks.delete(index)) emit({ type: "thinking", phase: "completed" });
  state.toolBlocks.delete(index);
};

const mapAssistantEvent = (
  event: ClaudeStreamEvent,
  state: ClaudeRuntimeEventState,
  emit: EmitRuntimeEvent,
): void => {
  const content = event.message?.content ?? [];
  for (const block of content) {
    if (block.type === "tool_use") {
      startTool({ state, emit, id: block.id, name: block.name, input: block.input });
    } else if (block.type === "text" && !state.sawTextDelta && block.text) {
      emit({ type: "message", text: block.text });
    }
  }
  const usage = event.message?.usage;
  if (usage && (usage.input_tokens !== undefined || usage.output_tokens !== undefined)) {
    emit({
      type: "usage",
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      model: event.message?.model,
    });
  }
};

const mapUserEvent = (
  event: ClaudeStreamEvent,
  state: ClaudeRuntimeEventState,
  emit: EmitRuntimeEvent,
): void => {
  for (const block of event.message?.content ?? []) {
    if (block.type !== "tool_result" || !block.tool_use_id) continue;
    const existing = state.tools.get(block.tool_use_id);
    const tool = existing ?? startTool({ state, emit, id: block.tool_use_id, name: "tool" });
    tool.completed = true;
    const isError = block.is_error === true;
    emit({
      type: "tool_update",
      id: block.tool_use_id,
      name: tool.name,
      status: isError ? "failed" : "completed",
      output: block.content,
    });
    emit({
      type: "tool_result",
      id: block.tool_use_id,
      output: block.content,
      isError,
    });
  }
};

const mapResultUsage = (event: ClaudeStreamEvent, emit: EmitRuntimeEvent): void => {
  const usageEntries = Object.entries(event.modelUsage ?? {});
  const inputTokens = usageEntries.reduce((sum, [, usage]) => sum + (usage.inputTokens ?? 0), 0);
  const outputTokens = usageEntries.reduce((sum, [, usage]) => sum + (usage.outputTokens ?? 0), 0);
  if (usageEntries.length === 0 && event.total_cost_usd === undefined) return;
  emit({
    type: "usage",
    inputTokens,
    outputTokens,
    costUsd: event.total_cost_usd,
    model: usageEntries.length === 1 ? usageEntries[0]?.[0] : undefined,
  });
};

export const createClaudeRuntimeEventState = (): ClaudeRuntimeEventState => ({
  sawTextDelta: false,
  thinkingBlocks: new Set(),
  toolBlocks: new Map(),
  tools: new Map(),
});

export const mapClaudeRuntimeEvent = (
  event: ClaudeStreamEvent,
  state: ClaudeRuntimeEventState,
  emit: EmitRuntimeEvent,
): void => {
  if (event.session_id && event.session_id !== state.sessionId) {
    state.sessionId = event.session_id;
    emit({ type: "session", phase: "captured", id: event.session_id });
  }
  if (event.type === "system" && event.subtype === "init") {
    emit({ type: "status", phase: "initializing", message: "Claude Code initialized" });

    return;
  }
  if (event.type === "stream_event") {
    mapStreamEvent(event, state, emit);

    return;
  }
  if (event.type === "assistant") {
    mapAssistantEvent(event, state, emit);

    return;
  }
  if (event.type === "user") {
    mapUserEvent(event, state, emit);

    return;
  }
  if (event.type === "result") mapResultUsage(event, emit);
};

export const flushClaudeRuntimeEventState = (
  state: ClaudeRuntimeEventState,
  emit: EmitRuntimeEvent,
): void => {
  for (const _index of state.thinkingBlocks) emit({ type: "thinking", phase: "completed" });
  state.thinkingBlocks.clear();
  for (const [id, tool] of state.tools) {
    if (tool.completed) continue;
    tool.completed = true;
    emit({ type: "tool_update", id, name: tool.name, status: "failed" });
    emit({
      type: "tool_result",
      id,
      output: "Claude Code ended before the tool completed",
      isError: true,
    });
  }
};
