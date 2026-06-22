import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  approveProposal: vi.fn(),
  appendMessage: vi.fn(),
  createSession: vi.fn(),
  generatePipelineFromApprovedProposal: vi.fn(),
  getSessionById: vi.fn(),
  ingestAttachment: vi.fn(),
  planSession: vi.fn(),
  supersedeProposal: vi.fn(),
}));

vi.mock("../../src/services.js", () => ({
  pipelineAgentSessionsService: {
    approveProposal: mocks.approveProposal,
    appendMessage: mocks.appendMessage,
    createSession: mocks.createSession,
    generatePipelineFromApprovedProposal: mocks.generatePipelineFromApprovedProposal,
    getSessionById: mocks.getSessionById,
    ingestAttachment: mocks.ingestAttachment,
    planSession: mocks.planSession,
    supersedeProposal: mocks.supersedeProposal,
  },
}));

import { pipelineAgentSessionsRoutes } from "../../src/routes/pipelineAgentSessions";

const makeApp = () => {
  const app = new Hono();
  app.route("/pipeline-agent-sessions", pipelineAgentSessionsRoutes);

  return app;
};

describe("pipelineAgentSessionsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a session from valid input", async () => {
    mocks.createSession.mockResolvedValue({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "draft",
    });

    const response = await makeApp().request("/pipeline-agent-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entrypoint: "new-pipeline-dialog",
        mode: "generate",
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        id: "session-1",
        entrypoint: "new-pipeline-dialog",
        mode: "generate",
      }),
    );
    expect(mocks.createSession).toHaveBeenCalledWith({
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
    });
  });

  it("returns 400 for invalid create session input", async () => {
    const response = await makeApp().request("/pipeline-agent-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entrypoint: "unknown",
        mode: "generate",
      }),
    });

    expect(response.status).toBe(400);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("returns a hydrated session by id", async () => {
    mocks.getSessionById.mockResolvedValue({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "proposal_ready",
      messages: [],
      attachments: [],
      contextArtifacts: [],
      proposals: [],
    });

    const response = await makeApp().request("/pipeline-agent-sessions/session-1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        id: "session-1",
        status: "proposal_ready",
      }),
    );
    expect(mocks.getSessionById).toHaveBeenCalledWith("session-1");
  });

  it("returns 404 when a session does not exist", async () => {
    mocks.getSessionById.mockResolvedValue(null);

    const response = await makeApp().request("/pipeline-agent-sessions/missing");

    expect(response.status).toBe(404);
  });

  it("appends a message to a session", async () => {
    mocks.appendMessage.mockResolvedValue({
      id: "message-1",
      sessionId: "session-1",
      role: "user",
      kind: "text",
      content: "Help me design a review pipeline",
    });

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "user",
        kind: "text",
        content: "Help me design a review pipeline",
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        id: "message-1",
        sessionId: "session-1",
      }),
    );
    expect(mocks.appendMessage).toHaveBeenCalledWith("session-1", {
      role: "user",
      kind: "text",
      content: "Help me design a review pipeline",
    });
  });

  it("approves a proposal for a session", async () => {
    mocks.approveProposal.mockResolvedValue(undefined);

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: "proposal-1" }),
    });

    expect(response.status).toBe(204);
    expect(mocks.approveProposal).toHaveBeenCalledWith("session-1", "proposal-1");
  });

  it("returns 409 when proposal approval is rejected by business rules", async () => {
    mocks.approveProposal.mockRejectedValue(
      new Error("Pipeline agent proposal proposal-1 cannot be approved from status approved"),
    );

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: "proposal-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Pipeline agent proposal proposal-1 cannot be approved from status approved",
    });
  });

  it("supersedes a proposal for a session", async () => {
    mocks.supersedeProposal.mockResolvedValue(undefined);

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/supersede", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: "proposal-1" }),
    });

    expect(response.status).toBe(204);
    expect(mocks.supersedeProposal).toHaveBeenCalledWith("session-1", "proposal-1");
  });

  it("accepts multipart file uploads for a session", async () => {
    mocks.ingestAttachment.mockResolvedValue({
      attachment: {
        id: "attachment-1",
        sessionId: "session-1",
        filename: "brief.txt",
        mimeType: "text/plain",
      },
      artifacts: [],
    });

    const formData = new FormData();
    formData.append("file", new File(["hello world"], "brief.txt", { type: "text/plain" }));
    formData.append("runtimeId", "runtime-mastra");

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/attachments", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        attachment: expect.objectContaining({
          id: "attachment-1",
          filename: "brief.txt",
        }),
      }),
    );
    expect(mocks.ingestAttachment).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        filename: "brief.txt",
        mimeType: "text/plain",
        runtimeId: "runtime-mastra",
      }),
    );
  });

  it("rejects oversized uploads before reading them into service memory", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.txt", { type: "text/plain" }),
    );

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/attachments", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(413);
    expect(mocks.ingestAttachment).not.toHaveBeenCalled();
  });

  it("streams planning events for a session", async () => {
    mocks.planSession.mockImplementation(async (_sessionId, input) => {
      await input.onProgress?.("planner: started");
      return {
        type: "question",
        question: "What output format do you want?",
      };
    });

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runtimeId: "runtime-codex" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const body = await response.text();
    expect(body).toContain("event: phase");
    expect(body).toContain("event: progress");
    expect(body).toContain("event: question");
    expect(body).toContain("What output format do you want?");
    expect(mocks.planSession).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        runtimeId: "runtime-codex",
        onProgress: expect.any(Function),
      }),
    );
  });

  it("returns 400 for malformed planning JSON without invoking the planner", async () => {
    const response = await makeApp().request("/pipeline-agent-sessions/session-1/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(mocks.planSession).not.toHaveBeenCalled();
  });

  it("generates a pipeline draft from an approved session", async () => {
    mocks.generatePipelineFromApprovedProposal.mockResolvedValue({
      pipeline: { id: "pipeline-1" },
    });

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/generate", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pipelineId: "pipeline-1" });
    expect(mocks.generatePipelineFromApprovedProposal).toHaveBeenCalledWith("session-1");
  });

  it("returns 404 when generation targets a missing session", async () => {
    mocks.generatePipelineFromApprovedProposal.mockRejectedValue(
      new Error("Pipeline agent session not found: missing"),
    );

    const response = await makeApp().request("/pipeline-agent-sessions/missing/generate", {
      method: "POST",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Pipeline agent session not found: missing",
    });
  });

  it("returns 409 when generation is rejected by session state", async () => {
    mocks.generatePipelineFromApprovedProposal.mockRejectedValue(
      new Error("Pipeline agent session session-1 does not have an approved proposal"),
    );

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/generate", {
      method: "POST",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Pipeline agent session session-1 does not have an approved proposal",
    });
  });

  it("returns an error when pipeline generation fails", async () => {
    mocks.generatePipelineFromApprovedProposal.mockRejectedValue(
      new Error("Agent returned invalid pipeline structure"),
    );

    const response = await makeApp().request("/pipeline-agent-sessions/session-1/generate", {
      method: "POST",
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Agent returned invalid pipeline structure",
    });
  });
});
