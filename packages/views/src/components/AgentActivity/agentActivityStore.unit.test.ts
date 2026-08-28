import { describe, expect, it, vi } from "vitest";
import {
  AgentRunSchema,
  createInitialAgentRunActivityMetrics,
  createInitialAgentRunActivitySnapshot,
  type AgentRun,
  type AgentRunEventEnvelope,
} from "@repo/schemas";
import {
  acquireAgentActivity,
  getAgentActivityEntry,
  selectAgentActivityViewModel,
  subscribeAgentActivity,
} from "./agentActivityStore";

const capabilities = {
  textStreaming: "delta" as const,
  thinking: true,
  toolEvents: true,
  usage: true,
  cancellation: "signal" as const,
  resume: "none" as const,
  pause: "none" as const,
  mcpInjection: "none" as const,
  imageInput: false,
};

const createRun = (runId: string): AgentRun => {
  const createdAt = "2026-08-27T00:00:00.000Z";

  return AgentRunSchema.parse({
    id: runId,
    owner: { type: "user", id: "local-owner" },
    runtimeConfigId: "local-codex",
    runtime: "codex",
    status: "running",
    executablePath: null,
    executableVersion: null,
    executableFingerprint: null,
    model: null,
    reasoningEffort: null,
    speed: null,
    cwd: "C:\\workspace",
    nativeSessionId: null,
    resumeFromRunId: null,
    permissionMode: "full-access",
    networkAccess: true,
    controlMode: false,
    allowedTools: [],
    controlScopes: [],
    runtimeCapabilities: capabilities,
    activitySnapshot: createInitialAgentRunActivitySnapshot(runId, "codex", "running"),
    activityMetrics: createInitialAgentRunActivityMetrics(),
    usage: null,
    resultText: null,
    errorCode: null,
    errorMessage: null,
    createdAt,
    startedAt: createdAt,
    firstOutputAt: null,
    lastActivityAt: createdAt,
    finishedAt: null,
  });
};

const envelope = (
  runId: string,
  sequence: number,
  event: AgentRunEventEnvelope["event"],
): AgentRunEventEnvelope => ({
  runId,
  sequence,
  createdAt: `2026-08-27T00:00:${String(sequence).padStart(2, "0")}.000Z`,
  event,
});

const sseResponse = (events: readonly AgentRunEventEnvelope[]): Response =>
  new Response(
    events
      .map(
        (entry) =>
          `id: ${entry.sequence}\nevent: runtime_event\ndata: ${JSON.stringify(entry)}\n\n`,
      )
      .join(""),
    { headers: { "content-type": "text/event-stream" } },
  );

describe("shared Agent Activity store", () => {
  it("caches the derived view model for an unchanged store snapshot", () => {
    const runId = `store-selector-${crypto.randomUUID()}`;
    const entry = getAgentActivityEntry(runId, {
      apiBaseUrl: "/api",
      request: vi.fn(),
    });
    const state = entry.store.getState();

    expect(selectAgentActivityViewModel(state)).toBe(selectAgentActivityViewModel(state));
  });

  it("does not expose cancellation before runtime capabilities are known", () => {
    const runId = `store-capabilities-${crypto.randomUUID()}`;
    const entry = getAgentActivityEntry(runId, {
      apiBaseUrl: "/api",
      request: vi.fn(),
    });

    entry.store.setState({ status: "running", capabilities: null });

    expect(selectAgentActivityViewModel(entry.store.getState()).canCancel).toBe(false);
  });

  it("isolates transports and removes a zero-reference entry from the registry", () => {
    const runId = `store-registry-${crypto.randomUUID()}`;
    const run = createRun(runId);
    const requestA = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(`/agent-runs/${runId}`)) {
        return new Response(JSON.stringify(run));
      }

      return new Response("stream unavailable", { status: 503 });
    });
    const requestB = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(`/agent-runs/${runId}`)) {
        return new Response(JSON.stringify(run));
      }

      return new Response("stream unavailable", { status: 503 });
    });
    const platformA = { apiBaseUrl: "/api", request: requestA };
    const platformB = { apiBaseUrl: "/api", request: requestB };
    const entryA = getAgentActivityEntry(runId, platformA);

    expect(getAgentActivityEntry(runId, platformB)).not.toBe(entryA);

    const release = acquireAgentActivity(entryA);
    release();

    expect(getAgentActivityEntry(runId, platformA)).not.toBe(entryA);
  });

  it("deduplicates a run transport and replays canonical envelopes to subscribers", async () => {
    const runId = `store-dedupe-${crypto.randomUUID()}`;
    const run = createRun(runId);
    const events = [
      envelope(runId, 3, {
        type: "status",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:03.000Z",
        phase: "running",
      }),
      envelope(runId, 9, {
        type: "text_delta",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:09.000Z",
        text: "hello",
      }),
      envelope(runId, 12, {
        type: "terminal",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:12.000Z",
        status: "completed",
        resultText: "hello",
      }),
    ];
    let runRequests = 0;
    let streamRequests = 0;
    const platform = {
      apiBaseUrl: "/api",
      request: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith(`/agent-runs/${runId}`)) {
          runRequests += 1;

          return new Response(JSON.stringify(run), {
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes(`/agent-runs/${runId}/events`)) {
          streamRequests += 1;
          expect(init?.headers).toMatchObject({ accept: "text/event-stream" });

          return sseResponse(events);
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    };
    const received: number[] = [];
    const releaseSubscription = subscribeAgentActivity(runId, platform, async (entry) => {
      // A slow first subscriber must not let later control/terminal envelopes
      // overtake it while the shared transport is delivering the stream.
      if (entry.sequence === 3) await new Promise((resolve) => setTimeout(resolve, 10));
      received.push(entry.sequence);
    });
    const entry = getAgentActivityEntry(runId, platform);
    const releaseSecondReference = acquireAgentActivity(entry);

    await vi.waitFor(() => {
      expect(entry.store.getState().connection).toBe("terminal");
    });

    expect(runRequests).toBe(1);
    expect(streamRequests).toBe(1);
    expect(received).toEqual([3, 9, 12]);
    expect(entry.store.getState().snapshot?.content).toBe("hello");
    expect(entry.store.getState().lastSequence).toBe(12);

    releaseSecondReference();
    releaseSubscription();
  });

  it("falls back to polling after three failed SSE attempts", async () => {
    vi.useFakeTimers();
    const runId = `store-poll-${crypto.randomUUID()}`;
    const run = createRun(runId);
    let streamRequests = 0;
    let pollRequests = 0;
    const terminal = envelope(runId, 17, {
      type: "terminal",
      runtime: "codex",
      timestamp: "2026-08-27T00:00:17.000Z",
      status: "completed",
      resultText: "polled",
    });
    const platform = {
      apiBaseUrl: "/api",
      request: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith(`/agent-runs/${runId}`)) {
          return new Response(JSON.stringify(run), {
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes(`/agent-runs/${runId}/events`)) {
          const acceptsJson =
            String(init?.headers && new Headers(init.headers).get("accept")) === "application/json";
          if (acceptsJson) {
            pollRequests += 1;

            return new Response(
              JSON.stringify({
                events: [terminal],
                nextCursor: "test-cursor",
                terminal: true,
              }),
              { headers: { "content-type": "application/json" } },
            );
          }
          streamRequests += 1;

          return new Response("stream unavailable", { status: 503 });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    };
    const release = subscribeAgentActivity(runId, platform, () => undefined);

    await vi.runAllTimersAsync();

    const entry = getAgentActivityEntry(runId, platform);
    expect(streamRequests).toBe(3);
    expect(pollRequests).toBeGreaterThanOrEqual(1);
    expect(entry.store.getState().connection).toBe("terminal");
    expect(entry.store.getState().snapshot?.terminalMessage).toBe("polled");
    release();
    vi.useRealTimers();
  });
});
