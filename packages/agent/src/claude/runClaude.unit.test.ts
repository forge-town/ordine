import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { spawnCommand } from "../spawn/spawnCommand";
import { runClaude } from "./runClaude";

vi.mock("../spawn/spawnCommand", () => ({
  spawnCommand: vi.fn(),
}));

const createFakeChild = () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: new PassThrough(),
    kill: vi.fn(),
  });

  return child;
};

describe("runClaude", () => {
  it("forwards only text deltas from partial stream events", async () => {
    const child = createFakeChild();
    vi.mocked(spawnCommand).mockImplementationOnce(
      () => child as unknown as ReturnType<typeof spawnCommand>,
    );
    const onAssistantChunk = vi.fn();

    const resultPromise = runClaude({
      systemPrompt: "Return valid JSON.",
      userPrompt: "Plan this.",
      cwd: process.cwd(),
      allowedTools: [],
      onAssistantChunk,
    });

    queueMicrotask(() => {
      const events = [
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "thinking_delta", thinking: "private reasoning" },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "input_json_delta", partial_json: '{"secret":true}' },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: '{"question":"What' },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: ' next?"}' },
          },
        },
        {
          type: "result",
          result: '{"question":"What next?"}',
        },
      ];

      for (const event of events) child.stdout.write(`${JSON.stringify(event)}\n`);
      child.emit("close", 0);
    });

    const result = await resultPromise;

    expect(onAssistantChunk.mock.calls.map(([chunk]) => chunk)).toEqual([
      '{"question":"What',
      ' next?"}',
    ]);
    expect(result.text).toBe('{"question":"What next?"}');
    expect(vi.mocked(spawnCommand).mock.calls[0]?.[1]).toContain("--include-partial-messages");
  });
});
