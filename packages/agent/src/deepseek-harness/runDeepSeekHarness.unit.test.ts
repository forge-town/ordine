import type { ChildProcessWithoutNullStreams } from "node:child_process";
// eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeSpawn } from "../runtime/runRuntimeProcess";
import { runDeepSeekHarnessSession } from "./runDeepSeekHarness";

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

describe("runDeepSeekHarnessSession", () => {
  it("requires the versioned ready/session/result contract", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child) as unknown as RuntimeSpawn;

    child.stdin.on("data", (chunk: Buffer) => {
      const request = JSON.parse(chunk.toString("utf8")) as {
        type: string;
        request_id: string;
        model?: { provider: string; id: string };
        resume_session_id?: string;
      };
      if (request.type !== "execute") return;
      expect(request.model).toEqual({ provider: "deepseek", id: "deepseek-chat" });
      expect(request.resume_session_id).toBe("dsh-prior-session");
      queueMicrotask(() => {
        (child.stdout as PassThrough).write(
          frame({
            v: 1,
            type: "session",
            request_id: request.request_id,
            session_id: "dsh-session-1",
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            v: 1,
            type: "thinking",
            request_id: request.request_id,
            content: "checking",
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            v: 1,
            type: "tool_call",
            request_id: request.request_id,
            call_id: "call-1",
            name: "read_file",
            arguments: '{"path":"README.md"}',
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            v: 1,
            type: "tool_result",
            request_id: request.request_id,
            call_id: "call-1",
            name: "read_file",
            output: "contents",
            is_error: false,
          }),
        );
        (child.stdout as PassThrough).write(
          frame({ v: 1, type: "text", request_id: request.request_id, content: "hello" }),
        );
        (child.stdout as PassThrough).write(
          frame({
            v: 1,
            type: "usage",
            request_id: request.request_id,
            input_tokens: 5,
            output_tokens: 1,
          }),
        );
        (child.stdout as PassThrough).write(
          frame({
            v: 1,
            type: "result",
            request_id: request.request_id,
            status: "completed",
            session_id: "dsh-session-1",
            resume_rejected: false,
          }),
        );
      });
    });

    const run = runDeepSeekHarnessSession(
      {
        systemPrompt: "system",
        userPrompt: "hello",
        cwd: "C:\\workspace",
        model: "deepseek/deepseek-chat",
        resumeSessionId: "dsh-prior-session",
        timeoutMs: 1000,
      },
      spawn,
    );
    (child.stdout as PassThrough).write(frame({ v: 1, type: "ready", protocol_version: 1 }));
    const result = await run;

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().text).toBe("hello");
    expect(result._unsafeUnwrap().events.map((event) => event.type)).toEqual([
      "status",
      "status",
      "session",
      "status",
      "thinking",
      "thinking_delta",
      "tool_start",
      "tool_update",
      "tool_update",
      "tool_result",
      "text_delta",
      "usage",
      "thinking",
      "terminal",
    ]);
    expect(result._unsafeUnwrap().sessionId).toBe("dsh-session-1");
  });

  it("rejects an incompatible profile protocol version", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child) as unknown as RuntimeSpawn;
    const run = runDeepSeekHarnessSession(
      {
        systemPrompt: "",
        userPrompt: "hello",
        cwd: "C:\\workspace",
        timeoutMs: 1000,
      },
      spawn,
    );

    (child.stdout as PassThrough).write(frame({ v: 1, type: "ready", protocol_version: 2 }));
    const result = await run;

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("failed");
    expect(result._unsafeUnwrapErr().message).toContain("protocol version");
  });

  it("honors an AbortSignal that was already cancelled", async () => {
    const child = fakeChild();
    const controller = new AbortController();
    controller.abort();
    const result = await runDeepSeekHarnessSession(
      {
        systemPrompt: "",
        userPrompt: "hello",
        cwd: "C:\\workspace",
        timeoutMs: 1000,
        signal: controller.signal,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("cancelled");
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
});
