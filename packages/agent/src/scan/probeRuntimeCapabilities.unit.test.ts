import type { ChildProcessWithoutNullStreams } from "node:child_process";
// eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnCommandMock = vi.hoisted(() => vi.fn());

vi.mock("../spawn/spawnCommand", () => ({
  spawnCommand: (...args: unknown[]) => spawnCommandMock(...args),
}));

import { probeRuntimeCapabilities } from "./probeRuntimeCapabilities";

const fakeHelpProcess = (help: string): ChildProcessWithoutNullStreams => {
  // eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter.
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  Object.assign(child, {
    stdin: new PassThrough(),
    stdout,
    stderr,
    killed: false,
    kill: vi.fn(() => true),
  });
  queueMicrotask(() => {
    stdout.end(help);
    stderr.end();
    child.emit("close", 0, null);
  });

  return child;
};

describe("probeRuntimeCapabilities", () => {
  beforeEach(() => spawnCommandMock.mockReset());

  it("detects OpenCode's permission bypass only from the exact run help flag", async () => {
    spawnCommandMock.mockReturnValue(
      fakeHelpProcess("--format json\n-s, --session <id>\n--dangerously-skip-permissions\n"),
    );

    await expect(
      probeRuntimeCapabilities({ runtime: "opencode", path: "C:\\bin\\opencode.exe" }),
    ).resolves.toMatchObject({ structuredOutput: true, resume: true, skipPermissions: true });
    expect(spawnCommandMock).toHaveBeenCalledWith(
      "C:\\bin\\opencode.exe",
      ["run", "--help"],
      expect.any(Object),
    );
  });

  it("does not infer permission bypass from similar help text", async () => {
    spawnCommandMock.mockReturnValue(fakeHelpProcess("--format json\n-s, --session <id>\n"));

    await expect(
      probeRuntimeCapabilities({ runtime: "opencode", path: "C:\\bin\\opencode.exe" }),
    ).resolves.toMatchObject({ skipPermissions: false });
  });
});
