import type { RuntimeEvent } from "@repo/schemas";

export type AgentActivityKind =
  | "status"
  | "thinking"
  | "tool"
  | "diagnostic"
  | "retry"
  | "usage"
  | "terminal";

export type AgentActivityEntry = {
  id: string;
  kind: AgentActivityKind;
  title: string;
  detail?: string;
  timestamp?: string;
};

const MAX_ACTIVITY_ENTRIES = 80;
const MAX_ACTIVITY_DETAIL_CHARS = 4_000;

const stringifyDetail = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return text.length > MAX_ACTIVITY_DETAIL_CHARS
    ? `${text.slice(0, MAX_ACTIVITY_DETAIL_CHARS)}\n…`
    : text;
};

export const appendAgentActivity = (
  entries: readonly AgentActivityEntry[],
  next: AgentActivityEntry,
): AgentActivityEntry[] => {
  const previous = entries.at(-1);
  if (next.kind === "thinking" && previous?.kind === "thinking") {
    const merged = {
      ...previous,
      ...next,
      id: previous.id,
      detail: `${previous.detail ?? ""}${next.detail ?? ""}`,
    };

    return [...entries.slice(0, -1), merged].slice(-MAX_ACTIVITY_ENTRIES);
  }
  const existingIndex = entries.findIndex((entry) => entry.id === next.id);
  if (existingIndex >= 0 && (next.kind === "tool" || next.kind === "terminal")) {
    return entries
      .map((entry, index) => (index === existingIndex ? { ...entry, ...next } : entry))
      .slice(-MAX_ACTIVITY_ENTRIES);
  }
  if (
    previous?.kind === next.kind &&
    previous.title === next.title &&
    previous.detail === next.detail
  ) {
    return [...entries];
  }

  return [...entries, next].slice(-MAX_ACTIVITY_ENTRIES);
};

export const runtimeEventToAgentActivity = (event: RuntimeEvent): AgentActivityEntry => {
  const base = { timestamp: event.timestamp };
  if (event.type === "thinking_delta") {
    return {
      ...base,
      id: `thinking-${event.timestamp}`,
      kind: "thinking",
      title: "Reasoning",
      detail: event.text,
    };
  }
  if (event.type === "thinking") {
    return {
      ...base,
      id: `thinking-${event.timestamp}`,
      kind: "thinking",
      title: "Reasoning",
      detail: event.phase === "started" ? "" : undefined,
    };
  }
  if (event.type === "tool_start") {
    return {
      ...base,
      id: `tool-${event.id}`,
      kind: "tool",
      title: event.name,
      detail: stringifyDetail(event.input),
    };
  }
  if (event.type === "tool_update") {
    return {
      ...base,
      id: `tool-${event.id}`,
      kind: "tool",
      title: `${event.name ?? event.id} · ${event.status}`,
      detail: stringifyDetail(event.output ?? event.input),
    };
  }
  if (event.type === "tool_result") {
    return {
      ...base,
      id: `tool-${event.id}`,
      kind: "tool",
      title: `${event.id} · ${event.isError ? "failed" : "completed"}`,
      detail: stringifyDetail(event.output),
    };
  }
  if (event.type === "diagnostic") {
    return {
      ...base,
      id: `diagnostic-${event.timestamp}-${event.code}`,
      kind: "diagnostic",
      title: event.code,
      detail: event.message,
    };
  }
  if (event.type === "retry") {
    return {
      ...base,
      id: `retry-${event.timestamp}`,
      kind: "retry",
      title: `Retry ${event.phase}`,
      detail: event.message,
    };
  }
  if (event.type === "usage") {
    return {
      ...base,
      id: "usage",
      kind: "usage",
      title: "Usage",
      detail: `input ${event.inputTokens ?? "—"} · output ${event.outputTokens ?? "—"}`,
    };
  }
  if (event.type === "terminal") {
    return {
      ...base,
      id: "terminal",
      kind: "terminal",
      title: `Run ${event.status}`,
    };
  }
  if (event.type === "status") {
    return {
      ...base,
      id: `status-${event.timestamp}-${event.phase}`,
      kind: "status",
      title: event.message ?? event.phase,
    };
  }

  return {
    ...base,
    id: `${event.type}-${event.timestamp}`,
    kind: "status",
    title:
      event.type === "session"
        ? `Session ${event.phase}`
        : event.type === "artifact"
          ? `Artifact ${event.path}`
          : event.type === "context"
            ? event.phase
            : event.type === "permission"
              ? `Permission ${event.outcome}`
              : event.type,
  };
};
