import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
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
      onTextDelta: (text) => {
        textDeltas.push(text);
      },
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    const systemPromptFlag =
      process.platform === "win32" ? "--system-prompt-file" : "--system-prompt";
    const systemPromptFlagIndex = args.indexOf(systemPromptFlag);

    expect(systemPromptFlagIndex).toBeGreaterThanOrEqual(0);
    if (process.platform === "win32") {
      const promptFilePath = args[systemPromptFlagIndex + 1]!;
      expect(promptFilePath).toBeTruthy();
      expect(args).not.toContain("Plan safely");
      expect(readFileSync(promptFilePath, "utf8")).toBe("Plan safely");
    } else {
      expect(args).toContain("Plan safely");
    }

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
    if (process.platform === "win32") {
      expect(existsSync(args[systemPromptFlagIndex + 1]!)).toBe(false);
    }
  });
});
