import { Result } from "neverthrow";
import type { PipelineAgentProposal } from "@repo/schemas";

const pipelineAgentSessionsBaseUrl =
  globalThis.window === undefined
    ? "http://localhost:9433/api/pipeline-agent-sessions"
    : globalThis.window.location.hostname === "localhost"
      ? "http://localhost:9433/api/pipeline-agent-sessions"
      : `${globalThis.window.location.origin}/api/pipeline-agent-sessions`;

export interface PipelineAgentSessionClientRecord {
  id: string;
  entrypoint: "new-pipeline-dialog" | "canvas-agent-panel";
  mode: "generate" | "edit";
  status: string;
}

export interface PipelineAgentAttachmentClientRecord {
  id: string;
  filename: string;
  parseStatus?: string | null;
}

export interface PipelineAgentAttachmentUploadResult {
  attachment?: PipelineAgentAttachmentClientRecord;
}

export type PipelineAgentPlanEvent =
  | { type: "phase"; phase: string }
  | { type: "progress"; message: string }
  | { type: "assistant_chunk"; text: string }
  | { type: "question"; question: string }
  | { type: "proposal_ready"; proposal: PipelineAgentProposal; proposalId: string }
  | { type: "done"; status: string }
  | { type: "error"; message: string };

const parseEventPayload = (raw: string): Record<string, unknown> | null =>
  Result.fromThrowable(
    () => JSON.parse(raw) as Record<string, unknown>,
    () => null,
  )().unwrapOr(null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readResponseJson = async <T>(response: Response): Promise<T> => {
  const body = await response.text();
  if (!response.ok) {
    const parsed = parseEventPayload(body);
    const message =
      isRecord(parsed) && typeof parsed.error === "string"
        ? parsed.error
        : body || `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return JSON.parse(body) as T;
};

const parseSseMessage = (message: string): PipelineAgentPlanEvent | null => {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (dataLines.length === 0) {
    return null;
  }

  const eventName = eventLine?.slice(6).trim() ?? "";
  const parsed = parseEventPayload(dataLines.map((line) => line.slice(5).trimStart()).join("\n"));

  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  switch (eventName) {
    case "phase": {
      return typeof parsed.phase === "string" ? { type: "phase", phase: parsed.phase } : null;
    }
    case "progress": {
      return typeof parsed.message === "string"
        ? { type: "progress", message: parsed.message }
        : null;
    }
    case "assistant_chunk": {
      return typeof parsed.text === "string"
        ? { type: "assistant_chunk", text: parsed.text }
        : null;
    }
    case "question": {
      return typeof parsed.question === "string"
        ? { type: "question", question: parsed.question }
        : null;
    }
    case "proposal_ready": {
      return isRecord(parsed.proposal) && typeof parsed.proposalId === "string"
        ? {
            type: "proposal_ready",
            proposal: parsed.proposal as PipelineAgentProposal,
            proposalId: parsed.proposalId,
          }
        : null;
    }
    case "done": {
      return typeof parsed.status === "string" ? { type: "done", status: parsed.status } : null;
    }
    case "error": {
      return typeof parsed.message === "string" ? { type: "error", message: parsed.message } : null;
    }
    default: {
      return typeof parsed.type === "string" ? (parsed as PipelineAgentPlanEvent) : null;
    }
  }
};

export const pipelineAgentSessionsClient = {
  async createSession(input: {
    entrypoint: "new-pipeline-dialog" | "canvas-agent-panel";
    mode: "generate" | "edit";
    pipelineId?: string;
    snapshot?: unknown;
  }): Promise<PipelineAgentSessionClientRecord> {
    const response = await fetch(pipelineAgentSessionsBaseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    return readResponseJson<PipelineAgentSessionClientRecord>(response);
  },

  async appendMessage(
    sessionId: string,
    input: { role: "user" | "assistant" | "system"; kind: string; content: string },
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    return readResponseJson(response);
  },

  async uploadAttachment(
    sessionId: string,
    file: File,
  ): Promise<PipelineAgentAttachmentUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/attachments`, {
      method: "POST",
      body: formData,
    });

    return readResponseJson<PipelineAgentAttachmentUploadResult>(response);
  },

  async approveProposal(sessionId: string, proposalId: string) {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  },

  async generatePipelineFromApprovedProposal(sessionId: string): Promise<{ pipelineId: string }> {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/generate`, {
      method: "POST",
    });

    return readResponseJson<{ pipelineId: string }>(response);
  },

  async planSessionStream(
    sessionId: string,
    input: {
      runtimeId?: string;
      onEvent: (event: PipelineAgentPlanEvent) => void;
    },
  ) {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.runtimeId ? { runtimeId: input.runtimeId } : {}),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }

    const decoder = new TextDecoder();
    const streamState = { buffer: "" };
    const emitBufferedMessages = () => {
      const messages = streamState.buffer.split(/\r?\n\r?\n/);
      streamState.buffer = messages.pop() ?? "";

      for (const message of messages) {
        const parsed = parseSseMessage(message);
        if (parsed) {
          input.onEvent(parsed);
        }
      }
    };

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        streamState.buffer += decoder.decode();
        emitBufferedMessages();
        const trailingMessage = streamState.buffer.trim();
        if (trailingMessage.length > 0) {
          const parsed = parseSseMessage(trailingMessage);
          if (parsed) {
            input.onEvent(parsed);
          }
        }
        break;
      }

      streamState.buffer += decoder.decode(chunk.value, { stream: true });
      emitBufferedMessages();
    }
  },
};
