import { Result } from "neverthrow";
import type { PipelineAgentProposal } from "@repo/schemas";

export interface PipelineAgentSessionClientRecord {
  id: string;
  entrypoint: "new-pipeline-dialog" | "canvas-agent-panel";
  mode: "generate" | "edit";
  status: string;
}

export type PipelineAgentPlanEvent =
  | { type: "phase"; phase: string }
  | { type: "progress"; message: string }
  | { type: "question"; question: string }
  | { type: "proposal_ready"; proposal: PipelineAgentProposal; proposalId: string }
  | { type: "done"; status: string }
  | { type: "error"; message: string };

const parseEventPayload = (raw: string): PipelineAgentPlanEvent | null =>
  Result.fromThrowable(
    () => JSON.parse(raw) as PipelineAgentPlanEvent,
    () => null,
  )().unwrapOr(null);

export const pipelineAgentSessionsClient = {
  async createSession(input: {
    entrypoint: "new-pipeline-dialog" | "canvas-agent-panel";
    mode: "generate" | "edit";
    pipelineId?: string;
    snapshot?: unknown;
  }): Promise<PipelineAgentSessionClientRecord> {
    const response = await fetch("/api/pipeline-agent-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    return response.json();
  },

  async appendMessage(
    sessionId: string,
    input: { role: "user" | "assistant" | "system"; kind: string; content: string },
  ) {
    const response = await fetch(`/api/pipeline-agent-sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    return response.json();
  },

  async uploadAttachment(sessionId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/pipeline-agent-sessions/${sessionId}/attachments`, {
      method: "POST",
      body: formData,
    });

    return response.json();
  },

  async approveProposal(sessionId: string, proposalId: string) {
    await fetch(`/api/pipeline-agent-sessions/${sessionId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId }),
    });
  },

  async generatePipelineFromApprovedProposal(sessionId: string): Promise<{ pipelineId: string }> {
    const response = await fetch(`/api/pipeline-agent-sessions/${sessionId}/generate`, {
      method: "POST",
    });

    return response.json();
  },

  async planSessionStream(
    sessionId: string,
    input: {
      runtimeId?: string;
      onEvent: (event: PipelineAgentPlanEvent) => void;
    },
  ) {
    const response = await fetch(`/api/pipeline-agent-sessions/${sessionId}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        input.runtimeId ? { runtimeId: input.runtimeId } : {},
      ),
    });
    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }

    const decoder = new TextDecoder();
    const streamState = { buffer: "" };

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      streamState.buffer += decoder.decode(chunk.value, { stream: true });
      const messages = streamState.buffer.split("\n\n");
      streamState.buffer = messages.pop() ?? "";

      for (const message of messages) {
        const lines = message.split("\n");
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (!dataLine) {
          continue;
        }

        const parsed = parseEventPayload(dataLine.slice(6));
        if (parsed) {
          input.onEvent(parsed);
        }
      }
    }
  },
};
