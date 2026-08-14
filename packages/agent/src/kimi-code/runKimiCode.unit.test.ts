import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runCliToCompletionMock = vi.fn();

vi.mock("../spawn", () => ({
  runCliToCompletion: (...args: unknown[]) => runCliToCompletionMock(...args),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { runKimiCode } from "./runKimiCode";

describe("runKimiCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes an empty job-scoped MCP config when no connector is selected", async () => {
    const captured = { configPath: "", config: "" };
    runCliToCompletionMock.mockImplementationOnce(async ({ args }: { args: string[] }) => {
      const configFlagIndex = args.indexOf("--mcp-config-file");
      captured.configPath = args[configFlagIndex + 1] ?? "";
      captured.config = await readFile(captured.configPath, "utf8");

      return ok("done");
    });

    const result = await runKimiCode({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "/tmp",
    });

    expect(result.isOk()).toBe(true);
    expect(JSON.parse(captured.config)).toEqual({ mcpServers: {} });
    expect(existsSync(captured.configPath)).toBe(false);
  });

  it("passes only the connector authorized for this job and removes its config", async () => {
    const captured = { configPath: "", config: "" };
    runCliToCompletionMock.mockImplementationOnce(async ({ args }: { args: string[] }) => {
      const configFlagIndex = args.indexOf("--mcp-config-file");
      captured.configPath = args[configFlagIndex + 1] ?? "";
      captured.config = await readFile(captured.configPath, "utf8");

      return ok("done");
    });

    const result = await runKimiCode({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: {
          github: { command: "github-mcp", args: ["serve"] },
        },
        toolNames: ["mcp__github__read_issue"],
      },
    });

    expect(result.isOk()).toBe(true);
    expect(JSON.parse(captured.config)).toEqual({
      mcpServers: {
        github: { command: "github-mcp", args: ["serve"] },
      },
    });
    expect(captured.config).not.toContain("blender");
    expect(existsSync(captured.configPath)).toBe(false);
  });

  it("reports the failed server, command, exit reason, and retry guidance", async () => {
    const captured = { configPath: "" };
    runCliToCompletionMock.mockImplementationOnce(async ({ args }: { args: string[] }) => {
      const configFlagIndex = args.indexOf("--mcp-config-file");
      captured.configPath = args[configFlagIndex + 1] ?? "";

      return err(
        new Error(
          "kimi exited with code 1: Failed to connect MCP servers: {'blender': McpError('Connection closed')}",
        ),
      );
    });
    const onProgress = vi.fn();

    const result = await runKimiCode({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: {
          blender: { command: "uvx", args: ["blender-mcp"] },
        },
        toolNames: ["mcp__blender__get_scene_info"],
      },
      onProgress,
    });

    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error.message).toContain("Kimi MCP startup failed");
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("server=blender"));
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("command=uvx"));
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("exit=code 1"));
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("reason=Connection closed"));
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("retry="));
    expect(existsSync(captured.configPath)).toBe(false);
  });

  it("preserves a concrete process-start reason in the MCP failure trace", async () => {
    runCliToCompletionMock.mockResolvedValueOnce(
      err(
        new Error(
          "kimi exited with code 1: Failed to connect MCP servers: {'broken': RuntimeError(\"Client failed to connect: [Errno 2] No such file or directory: 'missing-mcp'\")}",
        ),
      ),
    );
    const onProgress = vi.fn();

    await runKimiCode({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: { broken: { command: "missing-mcp" } },
        toolNames: ["mcp__broken__read"],
      },
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.stringContaining("reason=Client failed to connect: [Errno 2] No such file"),
    );
  });
});
