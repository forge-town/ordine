import { describe, expect, it, vi } from "vitest";
import { consumeAgentRunEventStream } from "./agentRunEventsClient";

describe("consumeAgentRunEventStream", () => {
  it("decodes UTF-8 across chunks, accepts CRLF, ignores malformed data, and flushes the tail", async () => {
    const source = [
      "data: not-json\r\n\r\n",
      `id: 2\r\nevent: runtime_event\r\ndata: ${JSON.stringify({
        runId: "run-1",
        sequence: 2,
        createdAt: "2026-08-24T00:00:00.000Z",
        event: {
          type: "message",
          runtime: "codex",
          timestamp: "2026-08-24T00:00:00.000Z",
          text: "跨块中文",
        },
      })}\r\n\r\n`,
      `id: 3\ndata: ${JSON.stringify({
        runId: "run-1",
        sequence: 3,
        createdAt: "2026-08-24T00:00:01.000Z",
        event: {
          type: "terminal",
          runtime: "codex",
          timestamp: "2026-08-24T00:00:01.000Z",
          status: "completed",
          resultText: "完成",
        },
      })}`,
    ].join("");
    const bytes = new TextEncoder().encode(source);
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              for (let offset = 0; offset < bytes.length; offset += 5) {
                controller.enqueue(bytes.slice(offset, offset + 5));
              }
              controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    );
    const envelopes: Array<{ sequence: number; text?: string }> = [];

    const result = await consumeAgentRunEventStream(
      { apiBaseUrl: "http://localhost:9433/api", request },
      {
        runId: "run-1",
        after: 1,
        onEnvelope: (envelope) => {
          envelopes.push({
            sequence: envelope.sequence,
            ...(envelope.event.type === "message" ? { text: envelope.event.text } : {}),
          });
        },
      },
    );

    expect(envelopes).toEqual([{ sequence: 2, text: "跨块中文" }, { sequence: 3 }]);
    expect(result).toEqual({ lastSequence: 3, terminalStatus: "completed" });
    expect(request).toHaveBeenCalledWith(
      "http://localhost:9433/api/agent-runs/run-1/events?after=1",
      expect.objectContaining({
        headers: expect.objectContaining({ "Last-Event-ID": "1" }),
      }),
    );
  });
});
