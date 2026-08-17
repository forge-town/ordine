import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
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
  };
  process.stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  process.stdout = new Readable({ read() {} });
  process.stderr = new Readable({ read() {} });
  process.kill = vi.fn();

  return process;
};

import { runClaude } from "./runClaude";

describe("runClaude MCP isolation", () => {
  const testState = { process: createMockProcess() };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.process = createMockProcess();
    spawnMock.mockReturnValue(testState.process);
  });

  it("uses a strict empty MCP config when the job declares no MCP", async () => {
    const promise = runClaude({ systemPrompt: "system", userPrompt: "user", cwd: "/tmp" });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    const configFlagIndex = args.indexOf("--mcp-config");
    expect(args).toContain("--strict-mcp-config");
    expect(configFlagIndex).toBeGreaterThan(-1);
    expect(JSON.parse(args[configFlagIndex + 1]!)).toEqual({ mcpServers: {} });

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
