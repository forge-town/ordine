import { resolve } from "node:path";
import type { AgentRunOutcome, AgentRunOptions } from "@repo/agent-engine";
import type { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  runtime: vi.fn(),
  claim: vi.fn(),
  transition: vi.fn(),
  update: vi.fn(),
  event: vi.fn(),
  events: vi.fn(),
}));
vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => ({ findById: mocks.runtime }),
  createAgentRunsDao: () => ({
    create: mocks.create,
    findById: mocks.findById,
    claimExecutor: mocks.claim,
    transition: mocks.transition,
    update: mocks.update,
    refreshLease: vi.fn(),
  }),
  createAgentRunEventsDao: () => ({ create: mocks.event, findManyByRunIdAfter: mocks.events }),
}));
import { AgentControlModeUnsupportedError, createAgentRunsService } from "../..";

const deferred = <T>() => {
  const state = {} as { resolve: (value: T) => void };
  const promise = new Promise<T>((resolve) => {
    state.resolve = resolve;
  });

  return { promise, resolve: (value: T) => state.resolve(value) };
};
const runtime = {
  id: "runtime",
  type: "codex",
  connection: { mode: "local", path: resolve("/fake/codex.exe") },
};
const request = {
  runtimeConfigId: "runtime",
  owner: { type: "test", id: "owner" },
  cwd: "C:/workspace",
  prompt: "hello",
  rebuildPrompt: "hello",
};

const fixture = () => {
  const rows = new Map<string, Record<string, unknown>>();
  const events: unknown[] = [];
  const store = (data: Record<string, unknown>) => {
    const row = {
      executablePath: null,
      executableVersion: null,
      executableFingerprint: null,
      nativeSessionId: null,
      usage: null,
      resultText: null,
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      firstOutputAt: null,
      lastActivityAt: null,
      finishedAt: null,
      executorId: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      ...data,
    };
    rows.set(data.id as string, row);

    return row;
  };
  mocks.runtime.mockResolvedValue(runtime);
  mocks.create.mockImplementation(async (data) => store(data));
  mocks.findById.mockImplementation(async (id) => rows.get(id) ?? null);
  mocks.update.mockImplementation(async (id, patch) => Object.assign(rows.get(id)!, patch));
  mocks.transition.mockImplementation(async (id, from, patch) => {
    const row = rows.get(id)!;

    return from.includes(row.status) ? Object.assign(row, patch) : null;
  });
  mocks.claim.mockImplementation(async (id, executorId, heartbeatAt, leaseExpiresAt) =>
    Object.assign(rows.get(id)!, { executorId, heartbeatAt, leaseExpiresAt }),
  );
  mocks.event.mockImplementation(async (data) => {
    const event = { ...data, sequence: events.length + 1, createdAt: new Date() };
    events.push(event);

    return event;
  });
  mocks.events.mockImplementation(async () => events);
  const runAgent = vi
    .fn<(options: AgentRunOptions) => Promise<AgentRunOutcome>>()
    .mockResolvedValue({ text: "done", usage: null });
  const service = createAgentRunsService(
    { transaction: async (callback: (db: unknown) => Promise<unknown>) => callback({}) } as never,
    {
      runAgent,
      scan: async () => [],
      // The service uses only the binary overload of readFile.
      readExecutable: (async () => Buffer.from("executable")) as unknown as typeof readFile,
      probeCapabilities: async () => ({
        structuredOutput: true,
        partialMessages: false,
        resume: true,
        sessionId: false,
        skipPermissions: false,
        reasoningEffort: false,
        variant: false,
        autoPermissions: false,
      }),
      firstOutputTimeoutMs: 0,
    },
  );

  return { service, runAgent, rows, store };
};

describe("Agent Run shutdown admission", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retains the public error identity for an unsupported control runtime", async () => {
    const { service, runAgent } = fixture();
    mocks.runtime.mockResolvedValueOnce({ ...runtime, type: "opencode" });
    const start = service.start({ ...request, controlMode: true, allowedTools: ["ordine.search"] });
    await expect(start).rejects.toBeInstanceOf(AgentControlModeUnsupportedError);
    await expect(start).rejects.toMatchObject({
      code: "CONTROL_MODE_UNSUPPORTED",
      name: "AgentControlModeUnsupportedError",
      runtime: "opencode",
      message: "opencode is not verified for MCP-only Agent Control mode",
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("cancels a run created after admission closes without initializing transient resources", async () => {
    const { service, store, rows, runAgent } = fixture();
    const entered = deferred<void>();
    const gate = deferred<void>();
    mocks.create.mockImplementation(async (data) => {
      entered.resolve();
      await gate.promise;

      return store(data);
    });
    const factory = vi.fn();
    const start = service.start(request, factory);
    await entered.promise;
    service.closeAdmission();
    const stop = service.stopOwnedRuns();
    gate.resolve();
    const { runId } = await start;
    await stop;
    expect(rows.get(runId)?.status).toBe("cancelled");
    expect(factory).not.toHaveBeenCalled();
    expect(runAgent).not.toHaveBeenCalled();
  });

  it.each(["transient", "claim"])(
    "waits for delayed %s setup and releases its resources without launching an actor",
    async (phase) => {
      const { service, rows, runAgent } = fixture();
      const entered = deferred<void>();
      const gate = deferred<void>();
      const dispose = vi.fn();
      if (phase === "claim") {
        const claim = mocks.claim.getMockImplementation()!;
        mocks.claim.mockImplementation(async (...args) => {
          entered.resolve();
          await gate.promise;

          return claim(...args);
        });
      }
      const start = service.start(request, async () => {
        if (phase === "transient") {
          entered.resolve();
          await gate.promise;
        }

        return { dispose };
      });
      await entered.promise;
      service.closeAdmission();
      const stopped = vi.fn();
      const stop = service.stopOwnedRuns().then(stopped);
      await Promise.resolve();
      expect(stopped).not.toHaveBeenCalled();
      gate.resolve();
      const { runId } = await start;
      await stop;
      expect(dispose).toHaveBeenCalledOnce();
      expect(rows.get(runId)).toMatchObject({
        status: "cancelled",
        executorId: null,
        leaseExpiresAt: null,
      });
      expect(runAgent).not.toHaveBeenCalled();
    },
  );

  it("still releases a transient lease when executor acquisition rejects", async () => {
    const { service, rows, runAgent } = fixture();
    mocks.claim.mockRejectedValue(new Error("lease storage unavailable"));
    const dispose = vi.fn();
    await expect(service.start(request, () => ({ dispose }))).rejects.toThrow(
      "lease storage unavailable",
    );
    expect(dispose).toHaveBeenCalledOnce();
    expect([...rows.values()][0]).toMatchObject({
      status: "failed",
      executorId: null,
      leaseExpiresAt: null,
    });
    expect(runAgent).not.toHaveBeenCalled();
    await service.stopOwnedRuns();
  });
});
