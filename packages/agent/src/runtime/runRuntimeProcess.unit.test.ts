// eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { runRuntimeProcess, type RuntimeSpawn } from "./runRuntimeProcess";

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

describe("runRuntimeProcess", () => {
  it("emits ordered events and succeeds only after a zero exit", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child) as unknown as RuntimeSpawn;
    const delivered: string[] = [];
    const run = runRuntimeProcess(
      {
        runtime: "codex",
        command: "codex",
        args: ["exec"],
        cwd: "C:\\workspace",
        timeoutMs: 1000,
        onEvent: (event) => {
          delivered.push(event.type);
        },
      },
      spawn,
    );

    (child.stdout as PassThrough).write("first\r\nfinal");
    child.emit("close", 0, null);

    const result = await run;
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().text).toBe("first\nfinal");
    expect(result._unsafeUnwrap().terminal.status).toBe("completed");
    expect(delivered).toEqual(["status", "message", "message", "terminal"]);
  });

  it("returns a terminal failed result with stderr diagnostics", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child) as unknown as RuntimeSpawn;
    const run = runRuntimeProcess(
      {
        runtime: "hermes",
        command: "hermes",
        args: [],
        cwd: "C:\\workspace",
        timeoutMs: 1000,
      },
      spawn,
    );

    (child.stderr as PassThrough).write("auth required\n");
    child.emit("close", 1, null);

    const result = await run;
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("failed");
    expect(result._unsafeUnwrapErr().message).toContain("auth required");
  });

  it("kills and reports cancellation through AbortSignal", async () => {
    const child = fakeChild();
    const kill = vi.mocked(child.kill);
    kill.mockImplementation(() => {
      queueMicrotask(() => child.emit("close", null, "SIGTERM"));

      return true;
    });
    const spawn = vi.fn(() => child) as unknown as RuntimeSpawn;
    const controller = new AbortController();
    const run = runRuntimeProcess(
      {
        runtime: "pi-agent",
        command: "pi",
        args: [],
        cwd: "C:\\workspace",
        timeoutMs: 1000,
        signal: controller.signal,
      },
      spawn,
    );

    controller.abort();
    const result = await run;

    expect(kill).toHaveBeenCalledWith("SIGTERM");
    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("cancelled");
  });

  it("honors an AbortSignal that was cancelled before spawning", async () => {
    const child = fakeChild();
    const kill = vi.mocked(child.kill);
    kill.mockImplementation(() => {
      queueMicrotask(() => child.emit("close", null, "SIGTERM"));

      return true;
    });
    const controller = new AbortController();
    controller.abort();
    const result = await runRuntimeProcess(
      {
        runtime: "pi-agent",
        command: "pi",
        args: [],
        cwd: "C:\\workspace",
        timeoutMs: 1000,
        signal: controller.signal,
      },
      vi.fn(() => child) as unknown as RuntimeSpawn,
    );

    expect(kill).toHaveBeenCalledWith("SIGTERM");
    expect(result._unsafeUnwrapErr().result.terminal.status).toBe("cancelled");
  });
});
