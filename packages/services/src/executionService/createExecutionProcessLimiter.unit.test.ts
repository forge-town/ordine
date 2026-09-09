import { describe, expect, it } from "vitest";
import { createExecutionProcessLimiter } from "./createExecutionProcessLimiter";

describe("instance and runtime process admission", () => {
  it("limits each runtime while allowing unrelated ready work and preserving FIFO", async () => {
    const limiter = createExecutionProcessLimiter({ maxProcesses: 2, maxPerRuntime: 1 });
    const signal = new AbortController().signal;
    const first = (await limiter.acquire("codex", signal))._unsafeUnwrap();
    const second = limiter.acquire("codex", signal);
    const other = (await limiter.acquire("python", signal))._unsafeUnwrap();
    expect(limiter.snapshot()).toMatchObject({ active: 2, queued: 1 });
    first();
    const next = (await second)._unsafeUnwrap();
    expect(limiter.snapshot()).toMatchObject({ active: 2, queued: 0 });
    next();
    next();
    other();
    expect(limiter.snapshot()).toEqual({ active: 0, queued: 0, runtimes: {} });
  });
  it("cancels queued admission without consuming a process slot", async () => {
    const limiter = createExecutionProcessLimiter({ maxProcesses: 1 });
    const release = (
      await limiter.acquire("runtime", new AbortController().signal)
    )._unsafeUnwrap();
    const controller = new AbortController();
    const queued = limiter.acquire("runtime", controller.signal);
    controller.abort();
    expect((await queued)._unsafeUnwrapErr().code).toBe("CANCELLED");
    release();
    expect(limiter.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });
  it("refuses an unbounded admission queue and frees capacity after release", async () => {
    const limiter = createExecutionProcessLimiter({ maxProcesses: 1, maxQueued: 1 });
    const signal = new AbortController().signal;
    const release = (await limiter.acquire("a", signal))._unsafeUnwrap();
    const queued = limiter.acquire("b", signal);
    expect((await limiter.acquire("c", signal))._unsafeUnwrapErr().code).toBe(
      "PROCESS_CAPACITY_EXCEEDED",
    );
    release();
    (await queued)._unsafeUnwrap()();
    expect(limiter.snapshot().active).toBe(0);
  });
});
