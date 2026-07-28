import { mkdtempSync, rmSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { agentEngine } from "@repo/agent-engine";
import { runAgent } from "./agentRunner";

vi.mock("@repo/agent-engine", () => ({
  agentEngine: {
    run: vi.fn().mockResolvedValue({ text: "output", usage: null }),
  },
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// A real directory: resolveCwd rejects explicitly configured paths that do not exist.
const inputDir = mkdtempSync(join(tmpdir(), "agent-runner-test-"));

afterAll(() => {
  rmSync(inputDir, { recursive: true, force: true });
});

describe("runAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseOpts = {
    agent: "claude-code" as const,
    systemPrompt: "sys",
    userPrompt: "user",
    inputPath: inputDir,
    agentId: "test-agent",
    logPrefix: "test",
  };

  it("returns agent output on success", async () => {
    const result = await runAgent(baseOpts);
    expect(result).toBe("output");
  });

  it("forwards all options to agentEngine", async () => {
    await runAgent({
      ...baseOpts,
      jobId: "job-1",
      allowedTools: ["Read"],
      onProgress: vi.fn(),
    });

    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "claude-code",
        mode: "direct",
        systemPrompt: "sys",
        userPrompt: "user",
        allowedTools: ["Read"],
        jobId: "job-1",
        agentId: "test-agent",
      }),
    );
  });

  it("forwards image attachments to agentEngine", async () => {
    await runAgent({
      ...baseOpts,
      agent: "mastra",
      attachments: [
        {
          kind: "image",
          filename: "diagram.png",
          mediaType: "image/png",
          dataBase64: "ZmFrZQ==",
        },
      ],
    });

    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "mastra",
        attachments: [
          expect.objectContaining({
            kind: "image",
            filename: "diagram.png",
          }),
        ],
      }),
    );
  });

  it("injects connected connector MCP config for claude-code and removes the temp file", async () => {
    const captured = { configPath: "", configContent: "" };

    vi.mocked(agentEngine.run).mockImplementationOnce(async (opts) => {
      captured.configPath = opts.mcpConfigPath ?? "";
      captured.configContent = await readFile(captured.configPath, "utf8");

      return { text: "output", usage: null };
    });

    const onProgress = vi.fn();
    await runAgent({
      ...baseOpts,
      onProgress,
      getClaudeMcpInjection: async () => ({
        mcpServers: {
          GitHub: { command: "github-mcp", args: ["--stdio"], env: { GH_TOKEN: "x" } },
        },
        toolNames: ["mcp__GitHub__create_issue"],
      }),
    });

    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpConfigPath: captured.configPath,
        mcpToolNames: ["mcp__GitHub__create_issue"],
      }),
    );
    expect(JSON.parse(captured.configContent)).toEqual({
      mcpServers: {
        GitHub: { command: "github-mcp", args: ["--stdio"], env: { GH_TOKEN: "x" } },
      },
    });
    expect(onProgress).toHaveBeenCalledWith("test: MCP tools injected — mcp__GitHub__create_issue");
    await expect(access(captured.configPath)).rejects.toThrow();
  });

  it("removes the temp MCP config when progress reporting fails after config creation", async () => {
    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce(
        "11111111-1111-4111-8111-111111111111" as ReturnType<typeof crypto.randomUUID>,
      );
    const configPath = join(
      tmpdir(),
      "ordine-claude-mcp-11111111-1111-4111-8111-111111111111.json",
    );
    const onProgress = vi.fn(async (line: string) => {
      if (line.includes("MCP tools injected")) {
        throw new Error("progress down");
      }
    });

    await expect(
      runAgent({
        ...baseOpts,
        onProgress,
        getClaudeMcpInjection: async () => ({
          mcpServers: { GitHub: { command: "github-mcp" } },
          toolNames: ["mcp__GitHub__create_issue"],
        }),
      }),
    ).rejects.toThrow("progress down");

    expect(agentEngine.run).not.toHaveBeenCalled();
    await expect(access(configPath)).rejects.toThrow();
    uuidSpy.mockRestore();
  });

  it("skips MCP config when no connected connector can be injected", async () => {
    const getClaudeMcpInjection = vi.fn().mockResolvedValue(null);

    await runAgent({ ...baseOpts, getClaudeMcpInjection });

    expect(getClaudeMcpInjection).toHaveBeenCalledTimes(1);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.not.objectContaining({
        mcpConfigPath: expect.any(String),
      }),
    );
  });

  it("skips connector MCP injection for SSH-backed claude-code runs", async () => {
    const getClaudeMcpInjection = vi.fn().mockResolvedValue({
      mcpServers: { GitHub: { command: "github-mcp" } },
      toolNames: ["mcp__GitHub__create_issue"],
    });
    const onProgress = vi.fn();

    await runAgent({
      ...baseOpts,
      ssh: { mode: "ssh", host: "remote.example.com", user: "runner" },
      onProgress,
      getClaudeMcpInjection,
    });

    expect(getClaudeMcpInjection).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith("test: MCP tools skipped for SSH runtime");
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        ssh: { mode: "ssh", host: "remote.example.com", user: "runner" },
        mcpConfigPath: undefined,
        mcpToolNames: undefined,
      }),
    );
  });

  it("does not read connector MCP config for non-claude runtimes", async () => {
    const getClaudeMcpInjection = vi.fn().mockResolvedValue({
      mcpServers: { GitHub: { command: "github-mcp" } },
      toolNames: ["mcp__GitHub"],
    });

    await runAgent({ ...baseOpts, agent: "mastra", getClaudeMcpInjection });

    expect(getClaudeMcpInjection).not.toHaveBeenCalled();
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "mastra",
        mcpConfigPath: undefined,
        mcpToolNames: undefined,
      }),
    );
  });

  it("throws on agent failure", async () => {
    vi.mocked(agentEngine.run).mockRejectedValueOnce(new Error("boom"));

    await expect(runAgent(baseOpts)).rejects.toThrow("boom");
  });

  it("calls onProgress with start and complete messages", async () => {
    const onProgress = vi.fn();
    await runAgent({ ...baseOpts, onProgress });

    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("test: agent=claude-code"));
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("test: claude-code complete"));
  });

  it("emits a structured user-action marker before failing on a missing input path", async () => {
    const onProgress = vi.fn();

    await expect(
      runAgent({ ...baseOpts, inputPath: "/nope/does/not/exist", onProgress }),
    ).rejects.toThrow(/does not exist/);

    const markerLine = onProgress.mock.calls
      .map((call) => call[0] as string)
      .find((line) => line.startsWith("@@USER_ACTION::"));
    expect(markerLine).toBeDefined();
    expect(markerLine).toContain('"kind":"configure-input"');
    expect(markerLine).toContain('"field":"inputPath"');
    expect(markerLine).toContain("/nope/does/not/exist");
    expect(agentEngine.run).not.toHaveBeenCalled();
  });
});
