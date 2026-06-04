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
