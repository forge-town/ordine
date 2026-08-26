import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.ORDINE_AGENT_API_TOKEN = "test-agent-api-token-that-is-long-enough";
});

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  getById: vi.fn(),
  getEvents: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("../../src/services.js", () => ({
  agentRunsService: mocks,
}));

import { agentRunsRoutes } from "../../src/routes/agentRuns";

const makeApp = () => {
  const app = new Hono();
  app.route("/agent-runs", agentRunsRoutes);

  return app;
};

const terminalEnvelope = {
  runId: "run-1",
  sequence: 7,
  createdAt: "2026-08-22T00:00:00.000Z",
  event: {
    type: "terminal" as const,
    runtime: "codex" as const,
    timestamp: "2026-08-22T00:00:00.000Z",
    status: "completed" as const,
  },
};
const authorizedHeaders = {
  Authorization: "Bearer test-agent-api-token-that-is-long-enough",
};

describe("agentRunsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscribe.mockReturnValue(() => undefined);
  });

  it("replays and closes a control-mode stream after its terminal event", async () => {
    mocks.getById.mockResolvedValue({ id: "run-1", status: "completed", controlMode: true });
    mocks.getEvents.mockResolvedValue([terminalEnvelope]);

    const response = await makeApp().request("/agent-runs/run-1/events", {
      headers: { ...authorizedHeaders, "Last-Event-ID": "6" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(mocks.getEvents).toHaveBeenCalledWith("run-1", 6);
    expect(body).toContain("id: 7");
    expect(body).toContain('"status":"completed"');
  });

  it("prefers the explicit after query and rejects malformed sequences", async () => {
    mocks.getById.mockResolvedValue({ id: "run-1", status: "running" });
    const response = await makeApp().request("/agent-runs/run-1/events?after=-1", {
      headers: { ...authorizedHeaders, "Last-Event-ID": "6" },
    });

    expect(response.status).toBe(400);
    expect(mocks.getEvents).not.toHaveBeenCalled();
  });

  it("makes cancellation idempotent by returning the current terminal run", async () => {
    const completed = { id: "run-1", status: "completed" };
    mocks.getById.mockResolvedValue(completed);
    mocks.cancel.mockResolvedValue(completed);

    const first = await makeApp().request("/agent-runs/run-1/cancel", {
      method: "POST",
      headers: authorizedHeaders,
    });
    const second = await makeApp().request("/agent-runs/run-1/cancel", {
      method: "POST",
      headers: authorizedHeaders,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
  });

  it("rejects unauthenticated run access before reading run state", async () => {
    const response = await makeApp().request("/agent-runs/run-1");

    expect(response.status).toBe(401);
    expect(mocks.getById).not.toHaveBeenCalled();
  });
});
