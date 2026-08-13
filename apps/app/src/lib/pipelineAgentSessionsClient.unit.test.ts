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
    vi.restoreAllMocks();
  });

  it("maps proposal_ready SSE events from the event line instead of the JSON payload type", async () => {
    const onEvent = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          'event: phase\ndata: {"phase":"planning"}\n\n',
          'event: proposal_ready\ndata: {"type":"proposal","proposal":{"mode":"generate","purpose":"Review repository code","inputs":["repo"],"outputs":["report"],"majorOperations":["review-code"],"executionFlow":["repo -> review-code -> report"],"assumptions":[],"openQuestions":[],"readiness":"ready_for_generation"},"proposalId":"proposal-1"}\n\n',
        ]),
      ) as typeof fetch;

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      onEvent,
    });

    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: "phase",
      phase: "planning",
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
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
  });

  it("flushes the trailing buffer when the stream closes without a final delimiter", async () => {
    const onEvent = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          'event: question\ndata: {"type":"question","question":"Need one more answer?"}',
        ]),
      ) as typeof fetch;

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      onEvent,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "question",
      question: "Need one more answer?",
    });
  });

  it("ignores proposal_ready SSE events with invalid proposal payloads", async () => {
    const onEvent = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          'event: proposal_ready\ndata: {"proposal":{"mode":"generate","purpose":"Missing required fields"},"proposalId":"proposal-1"}\n\n',
        ]),
      ) as typeof fetch;

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      onEvent,
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("passes an abort signal to the planning request", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockResolvedValue(createStreamResponse([])) as typeof fetch;

    await pipelineAgentSessionsClient.planSessionStream("session-1", {
      onEvent: vi.fn(),
      signal: controller.signal,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/pipeline-agent-sessions/session-1/plan",
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
