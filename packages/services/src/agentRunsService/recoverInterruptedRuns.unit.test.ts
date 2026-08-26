import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createEvent: vi.fn(),
  findManyRecoverable: vi.fn(),
  findTerminal: vi.fn(),
  transitionRun: vi.fn(),
  updateRun: vi.fn(),
}));

vi.mock("@repo/models", () => ({
  createAgentRunEventsDao: () => ({
    create: mocks.createEvent,
    findTerminalByRunId: mocks.findTerminal,
  }),
  createAgentRunsDao: () => ({
    findManyRecoverable: mocks.findManyRecoverable,
    transition: mocks.transitionRun,
    update: mocks.updateRun,
  }),
  createAgentRuntimesDao: () => ({}),
}));

import { createAgentRunsService } from "./createAgentRunsService";

describe("Agent Run restart recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists diagnostic and interrupted terminal events for every unfinished run", async () => {
    const createdAt = new Date("2026-08-23T00:00:00.000Z");
    const storedEvents: Array<{ runId: string; event: Record<string, unknown> }> = [];
    const observedEvents: Array<{ sequence: number; type: string }> = [];

    mocks.findManyRecoverable.mockResolvedValue([
      {
        id: "run-restarted",
        runtime: "codex",
        resultText: "partial result",
        nativeSessionId: "thread-123",
      },
    ]);
    mocks.createEvent.mockImplementation(
      async ({ runId, event }: { runId: string; event: Record<string, unknown> }) => {
        storedEvents.push({ runId, event });

        return {
          runId,
          sequence: storedEvents.length,
          createdAt,
          event,
        };
      },
    );
    mocks.updateRun.mockImplementation(async (_runId: string, patch: Record<string, unknown>) => ({
      ...patch,
    }));
    mocks.transitionRun.mockImplementation(
      async (_runId: string, _from: string[], patch: Record<string, unknown>) => ({ ...patch }),
    );

    const database = {
      transaction: async <T>(callback: (transaction: unknown) => Promise<T>) => callback({}),
    };
    const service = createAgentRunsService(database as never);
    service.subscribe("run-restarted", (envelope) => {
      observedEvents.push({ sequence: envelope.sequence, type: envelope.event.type });
    });

    await expect(service.recoverInterruptedRuns()).resolves.toEqual({
      count: 1,
      runIds: ["run-restarted"],
    });

    expect(storedEvents).toHaveLength(2);
    expect(storedEvents.map(({ event }) => event.type)).toEqual(["diagnostic", "terminal"]);
    expect(storedEvents[0]?.event).toMatchObject({
      code: "SERVER_RESTART_INTERRUPTED",
      retryable: true,
    });
    expect(storedEvents[1]?.event).toMatchObject({
      status: "interrupted",
      resultText: "partial result",
      sessionId: "thread-123",
    });
    expect(mocks.transitionRun).toHaveBeenCalledOnce();
    expect(mocks.transitionRun).toHaveBeenCalledWith(
      "run-restarted",
      ["queued", "running", "cancelling"],
      expect.objectContaining({
        status: "interrupted",
        errorCode: "SERVER_RESTART_INTERRUPTED",
      }),
    );
    expect(mocks.updateRun).toHaveBeenCalledWith("run-restarted", {
      terminalEventSequence: 2,
    });
    expect(observedEvents).toEqual([
      { sequence: 1, type: "diagnostic" },
      { sequence: 2, type: "terminal" },
    ]);
  });
});
