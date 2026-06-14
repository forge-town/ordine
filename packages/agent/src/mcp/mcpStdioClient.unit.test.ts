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
