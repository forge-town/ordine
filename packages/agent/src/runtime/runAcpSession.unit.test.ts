import type { ChildProcessWithoutNullStreams } from "node:child_process";
// eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { runAcpSession } from "./runAcpSession";
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

describe("runAcpSession", () => {
  it("normalizes ACP streaming, tool, usage, and terminal frames", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child) as unknown as RuntimeSpawn;
    const delivered: string[] = [];

    child.stdin.on("data", (chunk: Buffer) => {
      const request = JSON.parse(chunk.toString("utf8")) as {
        id: number;
        method: string;
      };
      if (request.method === "initialize") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(
            frame({ jsonrpc: "2.0", id: request.id, result: {} }),
          ),
        );
      }
      if (request.method === "session/new") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(
            frame({ jsonrpc: "2.0", id: request.id, result: { sessionId: "session-1" } }),
          ),
        );
      }
      if (request.method === "session/prompt") {
        queueMicrotask(() => {
          (child.stdout as PassThrough).write(
            frame({
              jsonrpc: "2.0",
              method: "session/update",
              params: {
                update: {
                  sessionUpdate: "agent_thought_chunk",
                  content: { type: "text", text: "thinking" },
                },
              },
            }),
          );
          (child.stdout as PassThrough).write(
            frame({
              jsonrpc: "2.0",
              method: "session/update",
              params: {
                update: {
                  sessionUpdate: "tool_call",
                  toolCallId: "tool-1",
                  title: "Read file",
                  rawInput: { path: "README.md" },
                },
              },
            }),
          );
          (child.stdout as PassThrough).write(
            frame({
              jsonrpc: "2.0",
              method: "session/update",
              params: {
                update: {
                  sessionUpdate: "tool_call_update",
                  toolCallId: "tool-1",
                  status: "completed",
                  rawOutput: "ok",
                },
              },
            }),
          );
          (child.stdout as PassThrough).write(
            frame({
              jsonrpc: "2.0",
              method: "session/update",
              params: {
                update: {
                  sessionUpdate: "agent_message_chunk",
                  content: { type: "text", text: "hello" },
                },
              },
            }),
          );
          (child.stdout as PassThrough).write(
            frame({
              jsonrpc: "2.0",
              id: request.id,
              result: { usage: { inputTokens: 4, outputTokens: 2 } },
            }),
          );
        });
      }
    });

    const result = await runAcpSession(
      {
        runtime: "mistral-vibe",
        command: "vibe-acp",
        args: [],
        cwd: "C:\\workspace",
        prompt: "say hello",
        timeoutMs: 1000,
        onEvent: (event) => {
          delivered.push(event.type);
        },
      },
      spawn,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().text).toBe("hello");
    expect(result._unsafeUnwrap().terminal.status).toBe("completed");
    expect(delivered).toEqual([
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
  });

  it("loads durable sessions and records auto-approved permission decisions", async () => {
    const child = fakeChild();
    const requests: Array<{ id: number; method?: string; result?: unknown }> = [];

    child.stdin.on("data", (chunk: Buffer) => {
      const request = JSON.parse(chunk.toString("utf8")) as {
        id: number;
        method?: string;
        result?: unknown;
      };
      requests.push(request);
      if (request.method === "initialize") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(frame({ id: request.id, result: {} })),
        );
      }
      if (request.method === "session/load") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(
            frame({
              id: request.id,
              result: { sessionId: "internal-2", openCodeSessionId: "durable-2" },
            }),
          ),
        );
      }
      if (request.method === "session/prompt") {
        queueMicrotask(() => {
          (child.stdout as PassThrough).write(
            frame({
              id: 21,
              method: "session/request_permission",
              params: {
                toolCall: { toolCallId: "tool-2", title: "Write README" },
                options: [
                  { optionId: "deny", kind: "reject_once" },
                  { optionId: "allow", kind: "allow_once" },
                ],
              },
            }),
          );
          (child.stdout as PassThrough).write(
            frame({
              method: "session/update",
              params: {
                update: {
                  sessionUpdate: "agent_message_chunk",
                  content: { type: "text", text: "resumed" },
                },
              },
            }),
          );
          (child.stdout as PassThrough).write(frame({ id: request.id, result: {} }));
        });
      }
    });

    const result = await runAcpSession(
      {
        runtime: "kiro",
        command: "kiro-cli",
        args: ["acp"],
        cwd: "C:\\workspace",
        prompt: "continue",
        resumeSessionId: "durable-1",
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(result._unsafeUnwrap().sessionId).toBe("durable-2");
    expect(result._unsafeUnwrap().events).toContainEqual(
      expect.objectContaining({
        type: "permission",
        outcome: "selected",
        selectedOptionId: "allow",
      }),
    );
    expect(requests).toContainEqual(
      expect.objectContaining({
        id: 21,
        result: { outcome: { outcome: "selected", optionId: "allow" } },
      }),
    );
  });

  it("uses model config options and converts cumulative snapshots into deltas", async () => {
    const child = fakeChild();
    const requests: Array<{ method?: string; params?: unknown }> = [];

    child.stdin.on("data", (chunk: Buffer) => {
      const request = JSON.parse(chunk.toString("utf8")) as {
        id: number;
        method?: string;
        params?: unknown;
      };
      requests.push(request);
      if (request.method === "initialize") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(frame({ id: request.id, result: {} })),
        );
      }
      if (request.method === "session/new") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(
            frame({
              id: request.id,
              result: {
                sessionId: "session-model",
                configOptions: [{ id: "models", type: "select", name: "Model", options: [] }],
              },
            }),
          ),
        );
      }
      if (request.method === "session/set_config_option") {
        queueMicrotask(() =>
          (child.stdout as PassThrough).write(frame({ id: request.id, result: {} })),
        );
      }
      if (request.method === "session/prompt") {
        queueMicrotask(() => {
          for (const text of ["Agent Haven", "Agent Haven - ready", "Agent Haven - ready"]) {
            (child.stdout as PassThrough).write(
              frame({
                method: "session/update",
                params: {
                  update: {
                    sessionUpdate: "agent_message_chunk",
                    content: { type: "text", text },
                  },
                },
              }),
            );
          }
          (child.stdout as PassThrough).write(frame({ id: request.id, result: {} }));
        });
      }
    });

    const result = await runAcpSession(
      {
        runtime: "mistral-vibe",
        command: "vibe-acp",
        args: [],
        cwd: "C:\\workspace",
        prompt: "hello",
        model: "swe-fast",
        timeoutMs: 1000,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(result._unsafeUnwrap().text).toBe("Agent Haven - ready");
    expect(requests).toContainEqual(
      expect.objectContaining({
        id: 3,
        method: "session/set_config_option",
        params: { sessionId: "session-model", configId: "models", value: "swe-fast" },
      }),
    );
    expect(
      result
        ._unsafeUnwrap()
        .events.filter((event) => event.type === "text_delta")
        .map((event) => event.text),
    ).toEqual(["Agent Haven", " - ready"]);
  });

  it("fails when the ACP stream contains malformed JSON", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child) as unknown as RuntimeSpawn;
    const run = runAcpSession(
      {
        runtime: "mistral-vibe",
        command: "vibe-acp",
        args: [],
        cwd: "C:\\workspace",
        prompt: "hello",
        timeoutMs: 1000,
      },
      spawn,
    );

    (child.stdout as PassThrough).write("{not-json}\n");
    const result = await run;

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("failed");
    expect(result._unsafeUnwrapErr().message).toContain("Malformed ACP frame");
  });

  it("honors an AbortSignal that was already cancelled", async () => {
    const child = fakeChild();
    const controller = new AbortController();
    controller.abort();
    const result = await runAcpSession(
      {
        runtime: "mistral-vibe",
        command: "vibe-acp",
        args: [],
        cwd: "C:\\workspace",
        prompt: "hello",
        timeoutMs: 1000,
        signal: controller.signal,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("cancelled");
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
});
