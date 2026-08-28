import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAgentRunEventCursor } from "@repo/schemas";

vi.hoisted(() => {
  process.env.ORDINE_AGENT_API_TOKEN = "test-agent-api-token-that-is-long-enough";
});

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  getById: vi.fn(),
  getEvents: vi.fn(),
  recordActivityTelemetry: vi.fn(),
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
      headers: { ...authorizedHeaders, "Last-Event-ID": encodeAgentRunEventCursor("run-1", 6) },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(mocks.getEvents).toHaveBeenCalledWith("run-1", 6);
    expect(body).toContain(`id: ${encodeAgentRunEventCursor("run-1", 7)}`);
    expect(body).toContain('"status":"completed"');
  });

  it("prefers the explicit after query and rejects malformed sequences", async () => {
    mocks.getById.mockResolvedValue({ id: "run-1", status: "running" });
    const response = await makeApp().request("/agent-runs/run-1/events?after=not-a-cursor", {
      headers: { ...authorizedHeaders, "Last-Event-ID": encodeAgentRunEventCursor("run-1", 6) },
    });

    expect(response.status).toBe(400);
    expect(mocks.getEvents).not.toHaveBeenCalled();
  });

  it("serves a bounded JSON event page for polling clients", async () => {
    mocks.getById.mockResolvedValue({ id: "run-1", status: "running" });
    mocks.getEvents.mockResolvedValue([terminalEnvelope]);

    const response = await makeApp().request(
      `/agent-runs/run-1/events?after=${encodeURIComponent(encodeAgentRunEventCursor("run-1", 3))}&limit=25`,
      {
        headers: { ...authorizedHeaders, Accept: "application/json; charset=utf-8" },
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getEvents).toHaveBeenCalledWith("run-1", 3, 25);
    expect(body).toEqual({
      events: [terminalEnvelope],
      nextCursor: encodeAgentRunEventCursor("run-1", 7),
      terminal: true,
    });
  });

  it("rejects an unbounded polling page", async () => {
    mocks.getById.mockResolvedValue({ id: "run-1", status: "running" });

    const response = await makeApp().request(
      `/agent-runs/run-1/events?after=${encodeURIComponent(encodeAgentRunEventCursor("run-1", 0))}&limit=501`,
      {
        headers: { ...authorizedHeaders, Accept: "application/json" },
      },
    );

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

  it("records validated activity telemetry through the authenticated run service", async () => {
    const run = { id: "run-1", status: "running" };
    const updated = { ...run, activityMetrics: { artifactOpenFailureCount: 1 } };
    mocks.getById.mockResolvedValue(run);
    mocks.recordActivityTelemetry.mockResolvedValue(updated);

    const response = await makeApp().request("/agent-runs/run-1/activity/telemetry", {
      method: "POST",
      headers: { ...authorizedHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "artifact_open_failed" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.recordActivityTelemetry).toHaveBeenCalledWith(run.id, {
      kind: "artifact_open_failed",
    });
    await expect(response.json()).resolves.toEqual(updated);
  });

  it("rejects unknown activity telemetry without calling the service", async () => {
    mocks.getById.mockResolvedValue({ id: "run-1", status: "running" });

    const response = await makeApp().request("/agent-runs/run-1/activity/telemetry", {
      method: "POST",
      headers: { ...authorizedHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "path_disclosure" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.recordActivityTelemetry).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated run access before reading run state", async () => {
    const response = await makeApp().request("/agent-runs/run-1");

    expect(response.status).toBe(401);
    expect(mocks.getById).not.toHaveBeenCalled();
  });
});
