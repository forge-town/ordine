import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("agentRunsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscribe.mockReturnValue(() => undefined);
  });

  it("replays exactly after Last-Event-ID and includes the terminal event", async () => {
    mocks.getById.mockResolvedValue({ id: "run-1", status: "completed" });
    mocks.getEvents.mockResolvedValue([terminalEnvelope]);

    const response = await makeApp().request("/agent-runs/run-1/events", {
      headers: { "Last-Event-ID": "6" },
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
      headers: { "Last-Event-ID": "6" },
    });

    expect(response.status).toBe(400);
    expect(mocks.getEvents).not.toHaveBeenCalled();
  });

  it("makes cancellation idempotent by returning the current terminal run", async () => {
    const completed = { id: "run-1", status: "completed" };
    mocks.getById.mockResolvedValue(completed);
    mocks.cancel.mockResolvedValue(completed);

    const first = await makeApp().request("/agent-runs/run-1/cancel", { method: "POST" });
    const second = await makeApp().request("/agent-runs/run-1/cancel", { method: "POST" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
  });
});
