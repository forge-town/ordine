import type { ChildProcessWithoutNullStreams } from "node:child_process";
// eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { runPiRpcSession } from "./runPiRpcSession";
import type { RuntimeSpawn } from "./runRuntimeProcess";

const fakeChild = () => {
  // eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  Object.assign(child, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => true),
  });

  return child;
};

const frame = (value: unknown): string => `${JSON.stringify(value)}\n`;

describe("runPiRpcSession", () => {
  it("normalizes Pi text, thinking, tool, usage, and terminal events", async () => {
    const child = fakeChild();
    child.stdin.on("data", (chunk: Buffer) => {
      const request = JSON.parse(chunk.toString("utf8")) as { type: string };
      if (request.type !== "prompt") return;
      queueMicrotask(() => {
        (child.stdout as PassThrough).write(frame({ type: "agent_start" }));
        (child.stdout as PassThrough).write(frame({ type: "turn_start" }));
        (child.stdout as PassThrough).write(
          frame({
            type: "message_update",
            assistantMessageEvent: { type: "thinking_start" },
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            type: "message_update",
            assistantMessageEvent: { type: "thinking_delta", delta: "plan" },
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            type: "message_update",
            assistantMessageEvent: { type: "thinking_end" },
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            type: "tool_execution_start",
            toolCallId: "tool-1",
            toolName: "read",
            args: { path: "README.md" },
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            type: "tool_execution_end",
            toolCallId: "tool-1",
            result: { content: [{ type: "text", text: "ok" }] },
            isError: false,
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "hello" },
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            type: "turn_end",
            message: { usage: { input: 7, output: 3, cacheRead: 2 } },
          }),
        );
        (child.stdout as PassThrough).write(frame({ type: "agent_end" }));
      });
    });

    const result = await runPiRpcSession(
      {
        command: "pi",
        args: ["--mode", "rpc"],
        cwd: "C:\\workspace",
        prompt: "hello",
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(result._unsafeUnwrap().text).toBe("hello");
    expect(result._unsafeUnwrap().terminal.status).toBe("completed");
    expect(result._unsafeUnwrap().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "thinking", phase: "started" }),
        expect.objectContaining({ type: "tool_start", id: "tool-1" }),
        expect.objectContaining({ type: "tool_result", id: "tool-1", isError: false }),
        expect.objectContaining({ type: "usage", inputTokens: 7, outputTokens: 3 }),
      ]),
    );
  });

  it("loads a parent session before sending the prompt", async () => {
    const child = fakeChild();
    const requests: string[] = [];
    child.stdin.on("data", (chunk: Buffer) => {
      const request = JSON.parse(chunk.toString("utf8")) as { id: number; type: string };
      requests.push(request.type);
      if (request.type === "new_session") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(
            frame({ type: "response", id: request.id, success: true }),
          ),
        );
      }
      if (request.type === "prompt") {
        queueMicrotask(() => {
          (child.stdout as PassThrough).write(
            frame({
              type: "message_update",
              assistantMessageEvent: { type: "text_delta", delta: "continued" },
            }),
          );
          (child.stdout as PassThrough).write(frame({ type: "agent_end" }));
        });
      }
    });

    const result = await runPiRpcSession(
      {
        command: "pi",
        args: ["--mode", "rpc"],
        cwd: "C:\\workspace",
        prompt: "continue",
        parentSession: "C:\\workspace\\.pi\\sessions\\previous.jsonl",
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(result._unsafeUnwrap().text).toBe("continued");
    expect(requests.slice(0, 2)).toEqual(["new_session", "prompt"]);
  });

  it("sends the Pi abort command for an already-aborted signal", async () => {
    const child = fakeChild();
    const commands: string[] = [];
    child.stdin.on("data", (chunk: Buffer) => {
      commands.push((JSON.parse(chunk.toString("utf8")) as { type: string }).type);
    });
    const controller = new AbortController();
    controller.abort();

    const result = await runPiRpcSession(
      {
        command: "pi",
        args: ["--mode", "rpc"],
        cwd: "C:\\workspace",
        prompt: "hello",
        signal: controller.signal,
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(commands).toContain("abort");
    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("cancelled");
  });
});
