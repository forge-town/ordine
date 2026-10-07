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
import { createAgentRunsService } from "../..";

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

  it("aborts a running actor immediately and waits for actor exit and disposer completion", async () => {
    const { service, rows, runAgent } = fixture();
    const entered = deferred<AbortSignal>();
    const actorExit = deferred<AgentRunOutcome>();
    const release = deferred<void>();
    const disposing = deferred<void>();
    runAgent.mockImplementation((options) => {
      entered.resolve(options.signal!);

      return actorExit.promise;
    });
    const dispose = vi.fn(async () => {
      disposing.resolve();
      await release.promise;
    });
    const { runId } = await service.start(request, () => ({ dispose }));
    const signal = await entered.promise;
    service.closeAdmission();
    expect(signal.aborted).toBe(true);
    const stopped = vi.fn();
    const stop = service.stopOwnedRuns().then(stopped);
    actorExit.resolve({ text: "partial", usage: null });
    await disposing.promise;
    expect(stopped).not.toHaveBeenCalled();
    release.resolve();
    await stop;
    expect(dispose).toHaveBeenCalledOnce();
    expect(rows.get(runId)).toMatchObject({
      status: "cancelled",
      executorId: null,
      leaseExpiresAt: null,
    });
  });
});
