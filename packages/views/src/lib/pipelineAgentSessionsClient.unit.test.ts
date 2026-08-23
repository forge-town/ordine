import { afterEach, describe, expect, it, vi } from "vitest";
import { createPipelineAgentSessionsClient } from "./pipelineAgentSessionsClient";

const createStreamResponse = (payload: string) =>
  new Response(payload, { headers: { "content-type": "text/event-stream" } });

const terminalEvent = `id: 1\nevent: runtime_event\ndata: ${JSON.stringify({
  runId: "run-1",
  sequence: 1,
  createdAt: "2026-08-23T00:00:00.000Z",
  event: {
    runtime: "codex",
    timestamp: "2026-08-23T00:00:00.000Z",
    type: "terminal",
    status: "completed",
  },
})}\n\n`;

describe("createPipelineAgentSessionsClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    globalThis.window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses the consuming platform API base and request transport", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session-1",
          entrypoint: "canvas-agent-panel",
          mode: "edit",
          status: "draft",
        }),
      ),
    );
    const client = createPipelineAgentSessionsClient({
      apiBaseUrl: "http://127.0.0.1:9433/api",
      request,
    });

    await client.createSession({ entrypoint: "canvas-agent-panel", mode: "edit" });

    expect(request).toHaveBeenCalledWith(
      "http://127.0.0.1:9433/api/pipeline-agent-sessions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("cancels the persisted active Agent run and clears its resume handle", async () => {
    globalThis.window.localStorage.setItem(
      "ordine.pipeline-agent.active-run.session-1",
      JSON.stringify({ runId: "run-1", lastSequence: 3 }),
    );
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "run-1",
          ownerType: "pipeline-agent-session",
          ownerId: "session-1",
          runtimeConfigId: "local-codex",
          runtime: "codex",
          runtimeExecutablePath: "C:/codex.exe",
          runtimeExecutableVersion: "1.0.0",
          runtimeExecutableFingerprint: "fingerprint",
          cwd: "C:/workspace",
          permissionMode: "full-access",
          networkAccess: true,
          status: "cancelled",
          lastSequence: 4,
          createdAt: "2026-08-23T00:00:00.000Z",
          startedAt: "2026-08-23T00:00:00.000Z",
          finishedAt: "2026-08-23T00:00:01.000Z",
        }),
      ),
    );
    const client = createPipelineAgentSessionsClient({
      apiBaseUrl: "http://127.0.0.1:9433/api",
      request,
    });

    await expect(client.cancelActiveRun("session-1")).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(
      "http://127.0.0.1:9433/api/pipeline-agent-sessions/session-1/cancel",
      { method: "POST" },
    );
    expect(request).toHaveBeenCalledWith("http://127.0.0.1:9433/api/agent-runs/run-1/cancel", {
      method: "POST",
    });
    expect(
      globalThis.window.localStorage.getItem("ordine.pipeline-agent.active-run.session-1"),
    ).toBeNull();
  });

  it("keeps polling while the completed run is still being projected", async () => {
    vi.useFakeTimers();
    const proposal = {
      mode: "edit",
      summary: "Run three generators concurrently",
      targetGraphIntent: "Fan out generation and merge the candidates",
      majorChanges: ["Add two generator nodes"],
      assumptions: [],
      openQuestions: [],
      actions: [{ type: "removeNode", nodeId: "obsolete-generator" }],
      diagnosticsPreview: [
        {
          code: "NODE_NOT_FOUND",
          severity: "warning",
          message: "The obsolete generator may already be absent",
          actionIndex: 0,
        },
      ],
      pendingOperations: [],
      readiness: "ready_for_generation",
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ runId: "run-1" })))
      .mockResolvedValueOnce(createStreamResponse(terminalEvent))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "session-1",
            entrypoint: "canvas-agent-panel",
            mode: "edit",
            status: "analyzing",
            latestProposalId: null,
            proposals: [],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "session-1",
            entrypoint: "canvas-agent-panel",
            mode: "edit",
            status: "proposal_ready",
            latestProposalId: "proposal-1",
            proposals: [
              {
                id: "proposal-1",
                mode: "edit",
                status: "proposal_ready",
                proposal,
              },
            ],
          }),
        ),
      );
    const onEvent = vi.fn();
    const client = createPipelineAgentSessionsClient({
      apiBaseUrl: "http://127.0.0.1:9433/api",
      request,
    });

    const planning = client.planSessionStream("session-1", { onEvent });
    await vi.runAllTimersAsync();
    await planning;

    expect(onEvent).toHaveBeenCalledWith({ type: "phase", phase: "finalizing" });
    expect(onEvent).toHaveBeenCalledWith({
      type: "proposal_ready",
      proposal,
      proposalId: "proposal-1",
    });
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "AGENT_RUN_PROJECTION_TIMEOUT" }),
    );
    expect(request).toHaveBeenCalledTimes(4);
  });
});
