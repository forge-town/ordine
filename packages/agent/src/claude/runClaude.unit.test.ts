import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import type { RuntimeEvent } from "@repo/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn<() => ChildProcess>();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...(args as [])),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const createMockProcess = () => {
  // eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter
  const process = new EventEmitter() as ChildProcess & {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    written: string[];
  };
  process.written = [];
  process.stdin = new Writable({
    write(chunk, _encoding, callback) {
      process.written.push(chunk.toString());
      callback();
    },
  });
  process.stdout = new Readable({ read() {} });
  process.stderr = new Readable({ read() {} });
  process.kill = vi.fn();

  return process;
};

import { runClaude } from "./runClaude";

describe("runClaude OpenDesign-compatible invocation", () => {
  const testState = { process: createMockProcess() };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.process = createMockProcess();
    spawnMock.mockReturnValue(testState.process);
  });

  it("leaves project and user MCP discovery untouched when no run config is injected", async () => {
    const promise = runClaude({ systemPrompt: "system", userPrompt: "user", cwd: "/tmp" });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    expect(args).not.toContain("--mcp-config");
    expect(args).not.toContain("--strict-mcp-config");
    expect(args).toContain("bypassPermissions");

    testState.process.stdout.push(
      `${JSON.stringify({
        type: "result",
        subtype: "success",
        duration_ms: 1,
        total_cost_usd: 0,
        num_turns: 1,
        result: "done",
      })}\n`,
    );
    testState.process.stdout.push(null);
    testState.process.stderr.push(null);
    testState.process.emit("close", 0);

    await expect(promise).resolves.toMatchObject({ text: "done" });
  });
});

describe("runClaude partial text deltas", () => {
  const testState = { process: createMockProcess() };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.process = createMockProcess();
    spawnMock.mockReturnValue(testState.process);
  });

  it("forwards only text_delta content and enables partial messages", async () => {
    const textDeltas: string[] = [];
    const promise = runClaude({
      systemPrompt: "Plan safely",
      userPrompt: "Plan this",
      cwd: "/tmp/project",
      supportsPartialMessages: true,
      onTextDelta: (text) => {
        textDeltas.push(text);
      },
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    expect(args).not.toContain("--system-prompt");
    expect(args).not.toContain("--system-prompt-file");
    const input = JSON.parse(testState.process.written.join("").trim()) as {
      message: { content: Array<{ text: string }> };
    };
    expect(input.message.content[0]?.text).toBe("Plan safely\n\n---\n\nPlan this");

    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"SECRET"}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"SECRET"}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"safe"}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":" preview"}}}\n',
    );
    testState.process.stdout.push('{"type":"result","result":"final"}');
    testState.process.stdout.push(null);
    testState.process.stderr.push(null);
    testState.process.emit("close", 0);

    const result = await promise;

    expect(args).toContain("--include-partial-messages");
    expect(textDeltas).toEqual(["safe", " preview"]);
    expect(textDeltas.join("")).not.toContain("SECRET");
    expect(result.text).toBe("final");
  });

  it("does not request partial messages until the exact CLI capability was probed", async () => {
    const promise = runClaude({
      systemPrompt: "Plan safely",
      userPrompt: "Plan this",
      cwd: "/tmp/project",
    });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    expect(args).not.toContain("--include-partial-messages");
    testState.process.stdout.push('{"type":"result","result":"done"}\n');
    testState.process.stdout.push(null);
    testState.process.stderr.push(null);
    testState.process.emit("close", 0);
    await expect(promise).resolves.toMatchObject({ text: "done" });
  });

  it("normalizes native session, thinking, tool, usage, and terminal events", async () => {
    const runtimeEvents: RuntimeEvent[] = [];
    const promise = runClaude({
      systemPrompt: "Read safely",
      userPrompt: "Read fixture.txt",
      cwd: "/tmp/project",
      allowedTools: ["Read"],
      onRuntimeEvent: (event) => {
        runtimeEvents.push(event);
      },
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    testState.process.stdout.push(
      '{"type":"system","subtype":"init","session_id":"claude-session-1"}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"checking"}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_stop","index":0}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tool-1","name":"Read","input":{}}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"file_path\\":\\"fixture.txt\\"}"}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"assistant","message":{"model":"claude-test","content":[{"type":"tool_use","id":"tool-1","name":"Read","input":{"file_path":"fixture.txt"}}],"usage":{"input_tokens":5,"output_tokens":2}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1","content":"fixture contents","is_error":false}]}}\n',
    );
    testState.process.stdout.push(
      '{"type":"stream_event","event":{"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":"done"}}}\n',
    );
    testState.process.stdout.push(
      '{"type":"result","subtype":"success","result":"done","total_cost_usd":0.01,"modelUsage":{"claude-test":{"inputTokens":5,"outputTokens":2,"costUSD":0.01}}}\n',
    );
    testState.process.stdout.push(null);
    testState.process.stderr.push(null);
    testState.process.emit("close", 0);

    await expect(promise).resolves.toMatchObject({ text: "done" });
    expect(runtimeEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "session", phase: "captured", id: "claude-session-1" }),
        expect.objectContaining({ type: "thinking", phase: "started" }),
        expect.objectContaining({ type: "thinking_delta", text: "checking" }),
        expect.objectContaining({ type: "thinking", phase: "completed" }),
        expect.objectContaining({ type: "tool_start", id: "tool-1", name: "Read" }),
        expect.objectContaining({
          type: "tool_update",
          id: "tool-1",
          name: "Read",
          status: "completed",
        }),
        expect.objectContaining({
          type: "tool_result",
          id: "tool-1",
          output: "fixture contents",
          isError: false,
        }),
        expect.objectContaining({ type: "text_delta", text: "done" }),
        expect.objectContaining({
          type: "usage",
          inputTokens: 5,
          outputTokens: 2,
          costUsd: 0.01,
        }),
        expect.objectContaining({
          type: "terminal",
          status: "completed",
          resultText: "done",
          sessionId: "claude-session-1",
        }),
      ]),
    );
    expect(runtimeEvents.map((event) => event.sequence)).toEqual(
      runtimeEvents.map((_, index) => index),
    );
  });
});
