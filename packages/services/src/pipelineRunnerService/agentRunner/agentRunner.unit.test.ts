import { mkdtempSync, rmSync } from "node:fs";
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

  it("forwards connector MCP injection to agentEngine", async () => {
    const connectorInjection = {
      mcpServers: {
        GitHub: { command: "github-mcp", args: ["--stdio"], env: { GH_TOKEN: "x" } },
      },
      toolNames: ["mcp__GitHub__create_issue"],
    };

    await runAgent({
      ...baseOpts,
      getMcpConnectorInjection: async () => connectorInjection,
    });

    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorInjection,
      }),
    );
  });

  it("fails when connector MCP injection cannot be prepared", async () => {
    await expect(
      runAgent({
        ...baseOpts,
        getMcpConnectorInjection: async () => {
          throw new Error("connector store down");
        },
      }),
    ).rejects.toThrow("connector store down");

    expect(agentEngine.run).not.toHaveBeenCalled();
  });

  it("skips MCP config when no connected connector can be injected", async () => {
    const getMcpConnectorInjection = vi.fn().mockResolvedValue(null);

    await runAgent({ ...baseOpts, getMcpConnectorInjection });

    expect(getMcpConnectorInjection).toHaveBeenCalledTimes(1);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.not.objectContaining({
        connectorInjection: expect.any(Object),
      }),
    );
  });

  it("leaves SSH connector handling to the selected runtime adapter", async () => {
    const getMcpConnectorInjection = vi.fn().mockResolvedValue({
      mcpServers: { GitHub: { command: "github-mcp" } },
      toolNames: ["mcp__GitHub__create_issue"],
    });
    const onProgress = vi.fn();

    await runAgent({
      ...baseOpts,
      ssh: { mode: "ssh", host: "remote.example.com", user: "runner" },
      onProgress,
      getMcpConnectorInjection,
    });

    expect(getMcpConnectorInjection).toHaveBeenCalledTimes(1);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        ssh: { mode: "ssh", host: "remote.example.com", user: "runner" },
        connectorInjection: {
          mcpServers: { GitHub: { command: "github-mcp" } },
          toolNames: ["mcp__GitHub__create_issue"],
        },
      }),
    );
  });

  it("passes connector MCP injection to non-claude runtimes", async () => {
    const getMcpConnectorInjection = vi.fn().mockResolvedValue({
      mcpServers: { GitHub: { command: "github-mcp" } },
      toolNames: ["mcp__GitHub"],
    });

    await runAgent({ ...baseOpts, agent: "mastra", getMcpConnectorInjection });

    expect(getMcpConnectorInjection).toHaveBeenCalledTimes(1);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "mastra",
        connectorInjection: {
          mcpServers: { GitHub: { command: "github-mcp" } },
          toolNames: ["mcp__GitHub"],
        },
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
