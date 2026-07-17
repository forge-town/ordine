import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { listMcpToolsStdio } from "./mcpStdioClient";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_SERVER = join(here, "mcpFakeServer.mjs");

describe("listMcpToolsStdio", () => {
  it("completes the handshake and returns the tool list", async () => {
    const result = await listMcpToolsStdio({ command: process.execPath, args: [FAKE_SERVER] });
    expect(result.isOk()).toBe(true);
    const tools = result._unsafeUnwrap();
    expect(tools.map((t) => t.name)).toEqual(["read_file", "write_file"]);
    expect(tools[0]!.description).toBe("Read a file");
  });

  it("follows nextCursor pagination and accumulates every page", async () => {
    const result = await listMcpToolsStdio({
      command: process.execPath,
      args: [FAKE_SERVER],
      env: { MCP_FAKE_MODE: "paginated" },
    });
    expect(result.isOk()).toBe(true);
    // read_file arrives on page 1, write_file only on page 2 — dropping the
    // second page would lose it.
    expect(result._unsafeUnwrap().map((t) => t.name)).toEqual(["read_file", "write_file"]);
  });

  it("treats an explicit empty tools list as a valid empty result", async () => {
    const result = await listMcpToolsStdio({
      command: process.execPath,
      args: [FAKE_SERVER],
      env: { MCP_FAKE_MODE: "empty" },
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([]);
  });

  it("returns err when the result has no tools array (not a false empty success)", async () => {
    const result = await listMcpToolsStdio({
      command: process.execPath,
      args: [FAKE_SERVER],
      env: { MCP_FAKE_MODE: "malformed" },
    });
    expect(result.isErr()).toBe(true);
  });

  it("fails fast when a server repeats the same pagination cursor forever", async () => {
    const result = await listMcpToolsStdio({
      command: process.execPath,
      args: [FAKE_SERVER],
      env: { MCP_FAKE_MODE: "cursorloop" },
      timeoutMs: 5000,
    });
    // Guard trips on the repeated cursor rather than spinning to the timeout.
    expect(result.isErr()).toBe(true);
  });

  it("returns err when the server exits before tools/list", async () => {
    const result = await listMcpToolsStdio({
      command: process.execPath,
      args: ["-e", "process.exit(1)"],
    });
    expect(result.isErr()).toBe(true);
  });

  it("returns err on timeout when the server never responds", async () => {
    const result = await listMcpToolsStdio({
      command: process.execPath,
      args: ["-e", "setTimeout(()=>{}, 60000)"],
      timeoutMs: 300,
    });
    expect(result.isErr()).toBe(true);
  });

  it("returns err when the command does not exist", async () => {
    const result = await listMcpToolsStdio({ command: "definitely-not-a-real-binary-xyz" });
    expect(result.isErr()).toBe(true);
  });
});
