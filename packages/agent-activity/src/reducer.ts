/* eslint-disable ordine-return/newline-before-return, ordine-vars/no-let */

import {
  AgentControlEventSchema,
  AgentRunActivitySnapshotSchema,
  AgentRunEventEnvelopeSchema,
  RuntimeEventSchema,
  createInitialAgentRunActivitySnapshot,
  type AgentControlEvent,
  type AgentRunActivityArtifact,
  type AgentRunActivityItem,
  type AgentRunActivityPatch,
  type AgentRunActivitySnapshot,
  type AgentRunActivityTool,
  type AgentRunEventEnvelope,
  type AgentRunUsage,
  type AgentRuntime,
  type RuntimeEvent,
} from "@repo/schemas";

const MAX_CONTENT_BYTES = 64 * 1024;
const MAX_PROGRESS_BYTES = 8 * 1024;
const MAX_ITEMS = 200;
const MAX_COMPLETED_TOOLS = 200;
const RUNTIME_EVENT_TYPES = new Set([
  "status",
  "session",
  "text_delta",
  "message",
  "thinking_delta",
  "thinking",
  "tool_start",
  "tool_update",
  "tool_result",
  "permission",
  "retry",
  "context",
  "usage",
  "artifact",
  "diagnostic",
  "terminal",
]);
const TERMINAL_STATUSES = new Set<AgentRunActivitySnapshot["status"]>([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);

const truncateUtf8 = (value: string, maxBytes: number): string => {
  if (new TextEncoder().encode(value).byteLength <= maxBytes) return value;
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = new TextEncoder().encode(character).byteLength;
    if (bytes + characterBytes > maxBytes) break;
    result += character;
    bytes += characterBytes;
  }

  return result;
};

const appendUtf8 = (current: string, value: string, maxBytes: number): string =>
  truncateUtf8(`${current}${value}`, maxBytes);

const item = (
  envelope: AgentRunEventEnvelope,
  kind: AgentRunActivityItem["kind"],
  label: string,
  id = `${kind}-${envelope.sequence}`,
) => ({
  id,
  sequence: envelope.sequence,
  kind,
  label: truncateUtf8(label, 2 * 1024) || kind,
  timestamp: envelope.createdAt,
});

const addItem = (
  snapshot: AgentRunActivitySnapshot,
  next: AgentRunActivitySnapshot["items"][number],
  replaceId?: string,
): void => {
  const index = replaceId ? snapshot.items.findIndex((entry) => entry.id === replaceId) : -1;
  if (index >= 0) {
    snapshot.items = snapshot.items.map((entry, entryIndex) =>
      entryIndex === index ? next : entry,
    );
  } else {
    snapshot.items = [...snapshot.items, next].slice(-MAX_ITEMS);
  }
};

const phaseForStatus = (
  status: AgentRunActivitySnapshot["status"],
): AgentRunActivitySnapshot["phase"] => {
  if (status === "cancelling") return "stopping";
  return status;
};

const mergeUsage = (
  current: AgentRunUsage | null,
  event: Extract<RuntimeEvent, { type: "usage" }>,
): AgentRunUsage => ({
  ...(current ?? {}),
  ...(event.inputTokens === undefined
    ? {}
    : { inputTokens: Math.max(current?.inputTokens ?? 0, event.inputTokens) }),
  ...(event.outputTokens === undefined
    ? {}
    : { outputTokens: Math.max(current?.outputTokens ?? 0, event.outputTokens) }),
  ...(event.cachedInputTokens === undefined
    ? {}
    : { cachedInputTokens: Math.max(current?.cachedInputTokens ?? 0, event.cachedInputTokens) }),
  ...(event.costUsd === undefined
    ? {}
    : { costUsd: Math.max(current?.costUsd ?? 0, event.costUsd) }),
});

const hashString = (value: string): string => {
  // FNV-1a is deterministic in browsers and Node and is only used as a
  // public stable identifier; the path itself never leaves the sanitized
  // snapshot in the identifier.
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return `artifact-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const artifactFromEvent = (
  event: Extract<RuntimeEvent, { type: "artifact" }>,
): AgentRunActivityArtifact => {
  const isRemote = /^(?:[a-z][a-z\d+.-]*:\/\/|ssh:|s3:|https?:)/i.test(event.path);
  const label = event.label ?? event.path.split(/[\\/]/).filter(Boolean).at(-1) ?? event.path;

  return {
    id: event.id ?? hashString(event.path),
    label: truncateUtf8(label, 512) || "Artifact",
    contentType: event.contentType ?? event.mediaType ?? "application/octet-stream",
    size: event.size ?? null,
    localPath: event.localPath ?? (isRemote ? null : event.path),
    remotePath: event.remotePath ?? (isRemote ? event.path : null),
    openModes: event.openModes ?? (isRemote ? ["copy_path"] : ["open", "copy_path"]),
  };
};

const updateTool = (
  snapshot: AgentRunActivitySnapshot,
  tool: AgentRunActivityTool,
  terminal = false,
): void => {
  snapshot.activeTools = snapshot.activeTools.filter((entry) => entry.id !== tool.id);
  if (terminal) {
    snapshot.completedTools = [
      ...snapshot.completedTools.filter((entry) => entry.id !== tool.id),
      tool,
    ].slice(-MAX_COMPLETED_TOOLS);
  } else {
    snapshot.activeTools = [
      ...snapshot.activeTools.filter((entry) => entry.id !== tool.id),
      tool,
    ].slice(-100);
  }
};

const applyRuntimeEvent = (
  snapshot: AgentRunActivitySnapshot,
  envelope: AgentRunEventEnvelope,
  event: RuntimeEvent,
): void => {
  switch (event.type) {
    case "status":
      snapshot.phase = event.phase;
      snapshot.progressMessage = event.message
        ? truncateUtf8(event.message, MAX_PROGRESS_BYTES)
        : null;
      addItem(snapshot, item(envelope, "status", event.message ?? event.phase));
      return;
    case "session":
      snapshot.progressMessage = `Session ${event.phase}`;
      addItem(snapshot, item(envelope, "session", `Session ${event.phase}`));
      return;
    case "text_delta":
      snapshot.content = appendUtf8(snapshot.content, event.text, MAX_CONTENT_BYTES);
      snapshot.phase = "streaming";
      snapshot.progressMessage = null;
      return;
    case "message":
      snapshot.content = snapshot.content
        ? snapshot.content.endsWith(event.text)
          ? snapshot.content
          : appendUtf8(`${snapshot.content}\n\n`, event.text, MAX_CONTENT_BYTES)
        : truncateUtf8(event.text, MAX_CONTENT_BYTES);
      snapshot.phase = "streaming";
      snapshot.progressMessage = null;
      addItem(snapshot, item(envelope, "message", "Message"));
      return;
    case "thinking_delta":
      // Reasoning is intentionally not copied into the public activity
      // snapshot. The UI gets a truthful phase without exposing hidden chain
      // of-thought content.
      snapshot.phase = "thinking";
      snapshot.progressMessage = "Thinking";
      return;
    case "thinking":
      snapshot.phase = "thinking";
      snapshot.progressMessage = event.phase === "started" ? "Thinking" : null;
      return;
    case "tool_start": {
      const tool: AgentRunActivityTool = {
        id: event.id,
        name: truncateUtf8(event.name, 512) || event.id,
        startedAt: event.timestamp,
        status: "in_progress",
      };
      updateTool(snapshot, tool);
      snapshot.phase = "tool";
      addItem(snapshot, item(envelope, "tool", tool.name, `tool-${tool.id}`), `tool-${tool.id}`);
      return;
    }
    case "tool_update": {
      const previous = snapshot.activeTools.find((entry) => entry.id === event.id);
      const tool: AgentRunActivityTool = {
        id: event.id,
        name: truncateUtf8(event.name ?? previous?.name ?? event.id, 512) || event.id,
        ...(previous?.startedAt ? { startedAt: previous.startedAt } : {}),
        status: event.status,
        ...(event.status === "completed" || event.status === "failed"
          ? { completedAt: event.timestamp }
          : {}),
      };
      updateTool(snapshot, tool, event.status === "completed" || event.status === "failed");
      addItem(
        snapshot,
        item(envelope, "tool", `${tool.name} · ${event.status}`, `tool-${tool.id}`),
        `tool-${tool.id}`,
      );
      return;
    }
    case "tool_result": {
      const previous = snapshot.activeTools.find((entry) => entry.id === event.id);
      const tool: AgentRunActivityTool = {
        id: event.id,
        name: previous?.name ?? event.id,
        ...(previous?.startedAt ? { startedAt: previous.startedAt } : {}),
        completedAt: event.timestamp,
        status: event.isError ? "failed" : "completed",
        ...(event.isError ? { error: true } : {}),
      };
      updateTool(snapshot, tool, true);
      addItem(
        snapshot,
        item(envelope, "tool", `${tool.name} · ${tool.status}`, `tool-${tool.id}`),
        `tool-${tool.id}`,
      );
      return;
    }
    case "permission":
      snapshot.phase = "waiting";
      snapshot.progressMessage = "Waiting for permission";
      addItem(snapshot, item(envelope, "permission", `Permission ${event.outcome}`));
      return;
    case "retry":
      snapshot.phase = "retrying";
      snapshot.progressMessage = event.message
        ? truncateUtf8(event.message, MAX_PROGRESS_BYTES)
        : `Retry ${event.phase}`;
      addItem(snapshot, item(envelope, "retry", `Retry ${event.phase}`));
      return;
    case "context":
      snapshot.phase = "compacting";
      snapshot.progressMessage = event.phase === "compaction_started" ? "Compacting context" : null;
      addItem(snapshot, item(envelope, "context", event.phase));
      return;
    case "usage":
      snapshot.usage = mergeUsage(snapshot.usage, event);
      addItem(snapshot, item(envelope, "usage", "Usage"), "usage");
      return;
    case "artifact": {
      const artifact = artifactFromEvent(event);
      snapshot.artifacts = [
        ...snapshot.artifacts.filter((entry) => entry.id !== artifact.id),
        artifact,
      ].slice(-200);
      addItem(snapshot, item(envelope, "artifact", artifact.label, `artifact-${artifact.id}`));
      return;
    }
    case "diagnostic":
      snapshot.progressMessage = truncateUtf8(event.message, MAX_PROGRESS_BYTES);
      if (event.level === "error") snapshot.errorCode = event.code;
      addItem(snapshot, item(envelope, "diagnostic", event.code));
      return;
    case "terminal":
      snapshot.status = event.status;
      snapshot.phase = event.status;
      snapshot.terminalAt = event.timestamp;
      snapshot.terminalMessage = event.resultText
        ? truncateUtf8(event.resultText, MAX_CONTENT_BYTES)
        : snapshot.terminalMessage;
      if (!snapshot.content && event.resultText)
        snapshot.content = truncateUtf8(event.resultText, MAX_CONTENT_BYTES);
      if (snapshot.activeTools.length > 0) {
        snapshot.completedTools = [
          ...snapshot.completedTools,
          ...snapshot.activeTools.map((tool) => ({
            ...tool,
            status: event.status === "completed" ? ("completed" as const) : ("failed" as const),
            completedAt: event.timestamp,
          })),
        ].slice(-MAX_COMPLETED_TOOLS);
        snapshot.activeTools = [];
      }
      addItem(snapshot, item(envelope, "terminal", `Run ${event.status}`), "terminal");
      return;
  }
};

const applyControlEvent = (
  snapshot: AgentRunActivitySnapshot,
  envelope: AgentRunEventEnvelope,
  event: AgentControlEvent,
): void => {
  const label = event.type.replaceAll("_", " ");
  snapshot.progressMessage = truncateUtf8(label, MAX_PROGRESS_BYTES);
  addItem(snapshot, item(envelope, "control", label, `control-${event.type}-${envelope.sequence}`));
};

export type AgentRunActivityReduction = {
  snapshot: AgentRunActivitySnapshot;
  accepted: boolean;
  duplicate: boolean;
};

/**
 * Reduce one canonical AgentRun envelope. `sequence` is an opaque, strictly
 * increasing database cursor: gaps are expected and never treated as packet
 * loss. Events at or below the snapshot cursor are idempotently ignored.
 */
export const reduceAgentRunActivity = (
  inputSnapshot: AgentRunActivitySnapshot,
  rawEnvelope: AgentRunEventEnvelope,
): AgentRunActivityReduction => {
  const snapshot = AgentRunActivitySnapshotSchema.parse(inputSnapshot);
  const envelope = AgentRunEventEnvelopeSchema.parse(rawEnvelope);
  if (envelope.runId !== snapshot.runId || envelope.sequence <= snapshot.latestSequence) {
    return { snapshot, accepted: false, duplicate: true };
  }
  // A terminal projection is immutable. A legacy run can still be replayed
  // from an initial terminal-status snapshot while latestSequence is zero;
  // once an event/terminal timestamp is present, later envelopes are stale.
  if (
    TERMINAL_STATUSES.has(snapshot.status) &&
    (snapshot.latestSequence > 0 || snapshot.terminalAt !== null)
  ) {
    return { snapshot, accepted: false, duplicate: false };
  }

  const next: AgentRunActivitySnapshot = {
    ...snapshot,
    activeTools: [...snapshot.activeTools],
    completedTools: [...snapshot.completedTools],
    artifacts: [...snapshot.artifacts],
    items: [...snapshot.items],
    latestSequence: envelope.sequence,
  };
  if (RUNTIME_EVENT_TYPES.has(envelope.event.type)) {
    applyRuntimeEvent(next, envelope, RuntimeEventSchema.parse(envelope.event));
  } else {
    applyControlEvent(next, envelope, AgentControlEventSchema.parse(envelope.event));
  }

  return {
    snapshot: AgentRunActivitySnapshotSchema.parse(next),
    accepted: true,
    duplicate: false,
  };
};

export const applyAgentRunActivityPatch = (
  inputSnapshot: AgentRunActivitySnapshot,
  patch: AgentRunActivityPatch,
): AgentRunActivitySnapshot => {
  const snapshot = AgentRunActivitySnapshotSchema.parse(inputSnapshot);
  if (patch.status) {
    snapshot.status = patch.status;
    snapshot.phase = phaseForStatus(patch.status);
  }
  if (patch.usage !== undefined) snapshot.usage = patch.usage;
  if (patch.errorCode !== undefined) snapshot.errorCode = patch.errorCode;
  if (patch.terminalMessage !== undefined) {
    snapshot.terminalMessage = patch.terminalMessage
      ? truncateUtf8(patch.terminalMessage, MAX_CONTENT_BYTES)
      : null;
  }
  if (patch.terminalAt !== undefined) snapshot.terminalAt = patch.terminalAt;

  return AgentRunActivitySnapshotSchema.parse(snapshot);
};

export const reduceAgentRunActivityEvents = (
  runId: string,
  runtime: AgentRuntime,
  envelopes: readonly AgentRunEventEnvelope[],
  status: AgentRunActivitySnapshot["status"] = "queued",
): AgentRunActivitySnapshot => {
  let snapshot = createInitialAgentRunActivitySnapshot(runId, runtime, status);
  for (const envelope of [...envelopes].sort((left, right) => left.sequence - right.sequence)) {
    snapshot = reduceAgentRunActivity(snapshot, envelope).snapshot;
  }

  return snapshot;
};

export const createInitialActivitySnapshot = createInitialAgentRunActivitySnapshot;
