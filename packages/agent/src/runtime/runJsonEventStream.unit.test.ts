import type { ChildProcessWithoutNullStreams } from "node:child_process";
// eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { runJsonEventStream } from "./runJsonEventStream";
import type { RuntimeSpawn } from "./runRuntimeProcess";

const fakeChild = () => {
  // eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  Object.assign(child, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    killed: false,
    kill: vi.fn(() => true),
  });

  return child;
};

describe("runJsonEventStream", () => {
  it("normalizes OpenCode sessions, text, tools, and usage", async () => {
    const child = fakeChild();
    const run = runJsonEventStream(
      {
        runtime: "opencode",
        kind: "opencode",
        command: "opencode",
        args: ["run", "--format", "json"],
        cwd: "C:\\workspace",
        stdin: "hello",
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    (child.stdout as PassThrough).write('{"type":"step_start","sessionID":"ses_1","part":{}}\n');
    (child.stdout as PassThrough).write(
      '{"type":"tool_use","sessionID":"ses_1","part":{"tool":"read","callID":"call_1","state":{"status":"running","input":"{\\"path\\":\\"README.md\\"}"}}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"tool_use","sessionID":"ses_1","part":{"tool":"read","callID":"call_1","state":{"status":"completed","output":"ok"}}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"text","sessionID":"ses_1","part":{"text":"done"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"step_finish","part":{"tokens":{"input":5,"output":2,"cache":{"read":1}},"cost":0.01}}\n',
    );
    child.emit("close", 0, null);

    const result = await run;
    expect(result._unsafeUnwrap().text).toBe("done");
    expect(result._unsafeUnwrap().sessionId).toBe("ses_1");
    expect(result._unsafeUnwrap().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool_start", id: "call_1" }),
        expect.objectContaining({ type: "tool_result", id: "call_1", isError: false }),
        expect.objectContaining({ type: "usage", inputTokens: 5, outputTokens: 2 }),
      ]),
    );
  });

  it("does not report success when OpenCode emits a structured error and exits zero", async () => {
    const child = fakeChild();
    const run = runJsonEventStream(
      {
        runtime: "opencode",
        kind: "opencode",
        command: "opencode",
        args: ["run", "--format", "json"],
        cwd: "C:\\workspace",
        stdin: "hello",
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    (child.stdout as PassThrough).write(
      '{"type":"error","error":{"message":"provider unauthorized"}}\n',
    );
    child.emit("close", 0, null);

    const result = await run;
    expect(result._unsafeUnwrapErr().message).toContain("provider unauthorized");
    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("failed");
  });

  it("normalizes Codex reasoning, command, file, MCP, web, usage, and thread id", async () => {
    const child = fakeChild();
    const run = runJsonEventStream(
      {
        runtime: "codex",
        kind: "codex",
        command: "codex",
        args: ["exec", "--json"],
        cwd: "C:\\workspace",
        stdin: "hello",
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    (child.stdout as PassThrough).write('{"type":"thread.started","thread_id":"thread_1"}\n');
    (child.stdout as PassThrough).write(
      '{"type":"item.updated","item":{"type":"reasoning","id":"r1","text":"plan"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.completed","item":{"type":"reasoning","id":"r1","text":"plan now"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.started","item":{"type":"command_execution","id":"cmd1","command":"pwd"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.completed","item":{"type":"command_execution","id":"cmd1","aggregated_output":"cwd","exit_code":0}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.started","item":{"type":"file_change","id":"file1","changes":[{"path":"C:\\\\workspace\\\\fixture.txt","kind":"add"}],"status":"in_progress"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.completed","item":{"type":"file_change","id":"file1","changes":[{"path":"C:\\\\workspace\\\\fixture.txt","kind":"add"}],"status":"completed"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.started","item":{"type":"mcp_tool_call","id":"mcp1","server":"ordine","tool":"list_jobs","arguments":{},"status":"in_progress"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.completed","item":{"type":"mcp_tool_call","id":"mcp1","server":"ordine","tool":"list_jobs","arguments":{},"result":{"content":[]},"error":null,"status":"completed"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.completed","item":{"type":"web_search","id":"web1","query":"ORDINE","status":"completed"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n',
    );
    (child.stdout as PassThrough).write(
      '{"type":"turn.completed","usage":{"input_tokens":9,"output_tokens":4,"cached_input_tokens":3}}\n',
    );
    child.emit("close", 0, null);

    const result = await run;
    expect(result._unsafeUnwrap().text).toBe("answer");
    expect(result._unsafeUnwrap().sessionId).toBe("thread_1");
    expect(result._unsafeUnwrap().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "thinking_delta", text: "plan" }),
        expect.objectContaining({ type: "tool_result", id: "cmd1", isError: false }),
        expect.objectContaining({ type: "tool_result", id: "file1", isError: false }),
        expect.objectContaining({ type: "artifact", path: "C:\\workspace\\fixture.txt" }),
        expect.objectContaining({ type: "tool_start", id: "mcp1", name: "ordine.list_jobs" }),
        expect.objectContaining({ type: "tool_result", id: "mcp1", isError: false }),
        expect.objectContaining({ type: "tool_result", id: "web1", isError: false }),
        expect.objectContaining({ type: "usage", cachedInputTokens: 3 }),
      ]),
    );
  });
});
