import { describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";

const spawnMock = vi.fn<() => ChildProcess>();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...(args as [])),
}));

import { spawnCommand } from "./spawnCommand";

describe("spawnCommand", () => {
  it("runs the command shim through cmd.exe on Windows", () => {
    // The canonical stdio connector form: `npx -y <mcp-server>`. On Windows npx
    // is npx.cmd, which spawn cannot start directly — it must go via cmd.exe.
    spawnCommand("npx", ["-y", "some-mcp-server"], { stdio: "pipe" }, "win32");

    expect(spawnMock).toHaveBeenCalledWith(
      "cmd.exe",
      ["/d", "/s", "/c", "npx", "-y", "some-mcp-server"],
      { stdio: "pipe" },
    );
  });

  it("spawns the binary directly on non-Windows platforms", () => {
    spawnCommand("npx", ["-y", "some-mcp-server"], { stdio: "pipe" }, "linux");

    expect(spawnMock).toHaveBeenCalledWith("npx", ["-y", "some-mcp-server"], { stdio: "pipe" });
  });

  it("spawns native Windows executables directly", () => {
    spawnCommand("C:\\tools\\hermes.exe", ["acp"], { stdio: "pipe" }, "win32");

    expect(spawnMock).toHaveBeenCalledWith("C:\\tools\\hermes.exe", ["acp"], { stdio: "pipe" });
  });
});
