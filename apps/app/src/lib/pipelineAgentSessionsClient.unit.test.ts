import { afterEach, describe, expect, it, vi } from "vitest";
import { pipelineAgentSessionsClient } from "./pipelineAgentSessionsClient";

const originalFetch = globalThis.fetch;

const createStreamResponse = (chunks: string[]) => {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream",
      },
    },
  );
};

describe("pipelineAgentSessionsClient.planSessionStream", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const runtimeEvent = (sequence: number, event: Record<string, unknown>) =>
    `id: ${sequence}\nevent: runtime_event\ndata: ${JSON.stringify({
      runId: "run-1",
      sequence,
      createdAt: "2026-08-22T00:00:00.000Z",
      event: {
        runtime: "codex",
        timestamp: "2026-08-22T00:00:00.000Z",
        ...event,
      },
    })}\n\n`;

  const sessionWithProposal = () =>
    new Response(
      JSON.stringify({
        id: "session-1",
        entrypoint: "new-pipeline-dialog",
        mode: "generate",
        status: "proposal_ready",
        latestProposalId: "proposal-1",
        proposals: [
          {
            id: "proposal-1",
            mode: "generate",
            status: "proposal_ready",
            proposal: {
              mode: "generate",
              purpose: "Review repository code",
              inputs: ["repo"],
              outputs: ["report"],
              majorOperations: ["review-code"],
              executionFlow: ["repo -> review-code -> report"],
              assumptions: [],
              openQuestions: [],
              readiness: "ready_for_generation",
            },
          },
        ],
      }),
    );

  it("starts a durable run, renders normalized events, and projects the saved proposal", async () => {
    const onEvent = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ runId: "run-1" })))
      .mockResolvedValueOnce(
        createStreamResponse([
          runtimeEvent(1, { type: "message", text: "Inspecting" }),
          runtimeEvent(2, { type: "tool_start", id: "tool-1", name: "shell" }),
          runtimeEvent(2, { type: "tool_start", id: "tool-1", name: "shell" }),
          runtimeEvent(3, { type: "usage", inputTokens: 10, outputTokens: 4 }),
          runtimeEvent(4, { type: "terminal", status: "completed" }),
        ]),
      )
      .mockResolvedValueOnce(sessionWithProposal()) as typeof fetch;

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      model: "gpt-5.6",
      onEvent,
      reasoningEffort: "high",
      runtimeId: "local-codex",
      speed: "priority",
    });

    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: "phase",
      phase: "analyzing",
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: "assistant_chunk",
      text: "Inspecting",
    });
    expect(onEvent).toHaveBeenNthCalledWith(3, {
      type: "tool",
      phase: "start",
      id: "tool-1",
      name: "shell",
    });
    expect(onEvent).toHaveBeenCalledWith({
      type: "usage",
      inputTokens: 10,
      outputTokens: 4,
      cachedInputTokens: undefined,
      costUsd: undefined,
    });
    expect(onEvent).toHaveBeenCalledWith({
      type: "proposal_ready",
      proposal: {
        mode: "generate",
        purpose: "Review repository code",
        inputs: ["repo"],
        outputs: ["report"],
        majorOperations: ["review-code"],
        executionFlow: ["repo -> review-code -> report"],
        assumptions: [],
        openQuestions: [],
        readiness: "ready_for_generation",
      },
      proposalId: "proposal-1",
    });
    expect(onEvent).toHaveBeenCalledTimes(7);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/pipeline-agent-sessions/session-1/runs",
      expect.objectContaining({ method: "POST" }),
    );
    const startRequest = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(startRequest?.body))).toEqual({
      runtimeId: "local-codex",
      model: "gpt-5.6",
      reasoningEffort: "high",
      speed: "priority",
    });
  });

  it("flushes a terminal event without a final delimiter and restores the saved question", async () => {
    const onEvent = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ runId: "run-1" })))
      .mockResolvedValueOnce(
        createStreamResponse([runtimeEvent(1, { type: "terminal", status: "completed" }).trim()]),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "session-1",
            entrypoint: "new-pipeline-dialog",
            mode: "generate",
            status: "awaiting_user",
            messages: [
              {
                id: "message-1",
                role: "assistant",
                kind: "question",
                content: "Need one more answer?",
              },
            ],
          }),
        ),
      ) as typeof fetch;

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      onEvent,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "question",
      question: "Need one more answer?",
    });
  });

  it("resumes from the saved sequence without duplicating replayed events", async () => {
    const onEvent = vi.fn();
    globalThis.window.localStorage.setItem(
      "ordine.pipeline-agent.active-run.session-1",
      JSON.stringify({ runId: "run-1", lastSequence: 1 }),
    );
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "run-1",
            owner: { type: "pipeline-agent-session", id: "session-1" },
            runtimeConfigId: "local-codex",
            runtime: "codex",
            status: "running",
            executablePath: "C:\\bin\\codex.exe",
            executableVersion: "1.0.0",
            executableFingerprint: "hash",
            model: null,
            cwd: "C:\\repo",
            nativeSessionId: null,
            resumeFromRunId: null,
            permissionMode: "workspace-write",
            networkAccess: true,
            usage: null,
            resultText: null,
            errorCode: null,
            errorMessage: null,
            createdAt: "2026-08-22T00:00:00.000Z",
            startedAt: "2026-08-22T00:00:00.000Z",
            firstOutputAt: null,
            lastActivityAt: null,
            finishedAt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(
        createStreamResponse([
          runtimeEvent(1, { type: "message", text: "duplicate" }),
          runtimeEvent(2, { type: "message", text: "new" }),
          runtimeEvent(3, { type: "terminal", status: "completed" }),
        ]),
      )
      .mockResolvedValueOnce(sessionWithProposal()) as typeof fetch;

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      onEvent,
    });

    expect(onEvent).toHaveBeenCalledWith({ type: "phase", phase: "reconnecting" });
    expect(onEvent).toHaveBeenCalledWith({ type: "assistant_chunk", text: "new" });
    expect(onEvent).not.toHaveBeenCalledWith({ type: "assistant_chunk", text: "duplicate" });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/agent-runs/run-1/events?after=1",
      expect.objectContaining({
        headers: expect.objectContaining({ "Last-Event-ID": "1" }),
      }),
    );
  });

  it("passes an abort signal to the planning request", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ runId: "run-1" }))) as typeof fetch;
    controller.abort();

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      onEvent: vi.fn(),
      signal: controller.signal,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/pipeline-agent-sessions/session-1/runs",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("requests server-side cancellation", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 })) as typeof fetch;

    await pipelineAgentSessionsClient.cancelSession("session-1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/pipeline-agent-sessions/session-1/cancel",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps the selected local runtime when generation starts", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ pipelineId: "pipeline-1" }), {
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;

    await pipelineAgentSessionsClient.generatePipelineFromApprovedProposal("session-1", {
      runtimeId: "local-codex",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/pipeline-agent-sessions/session-1/generate",
      expect.objectContaining({
        body: JSON.stringify({ runtimeId: "local-codex" }),
        method: "POST",
      }),
    );
  });
});

describe("pipelineAgentSessionsClient.waitForCreatedPipeline", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("stops polling when the abort signal is triggered", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session-1",
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
          status: "generating",
        }),
      ),
    ) as typeof fetch;

    const controller = new AbortController();
    const waitPromise = pipelineAgentSessionsClient.waitForCreatedPipeline("session-1", {
      intervalMs: 10,
      signal: controller.signal,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    controller.abort();

    await expect(waitPromise).rejects.toThrow(
      "Stopped waiting for generated pipeline in session session-1",
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("pipelineAgentSessionsClient.getGeneratedPipelineMaterialization", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("downloads the generated pipeline and every referenced operation", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "pipeline-1",
            name: "Generated pipeline",
            description: "",
            sharedContext: "",
            tags: ["agent-generated"],
            timeoutMs: null,
            nodes: [
              {
                id: "node-1",
                type: "operation",
                position: { x: 0, y: 0 },
                data: {
                  label: "Generated operation",
                  nodeType: "operation",
                  operationId: "operation-1",
                  operationName: "Generated operation",
                  status: "idle",
                },
              },
            ],
            edges: [],
            createdAt: "2026-08-10T00:00:00.000Z",
            updatedAt: "2026-08-10T00:00:00.000Z",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "operation-1",
            name: "Generated operation",
            description: "",
            config: {
              executor: { type: "agent", prompt: "Return OK", agentMode: "prompt" },
              inputs: [],
              outputs: [],
            },
            acceptedObjectTypes: ["prompt"],
            sourceSkillId: null,
          }),
        ),
      ) as typeof fetch;

    const result =
      await pipelineAgentSessionsClient.getGeneratedPipelineMaterialization("pipeline-1");

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/pipelines/pipeline-1",
      { signal: undefined },
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/operations/operation-1",
      { signal: undefined },
    );
    expect(result.pipeline.id).toBe("pipeline-1");
    expect(result.operations).toEqual([
      expect.objectContaining({ id: "operation-1", sourceSkillId: undefined }),
    ]);
  });
});
