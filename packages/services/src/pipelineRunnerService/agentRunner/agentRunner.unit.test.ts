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

  it("uses an explicitly injected persistent run controller", async () => {
    const agentRunController = vi.fn().mockResolvedValue({ text: "persistent", usage: null });

    const result = await runAgent({ ...baseOpts, agentRunController });

    expect(result).toBe("persistent");
    expect(agentRunController).toHaveBeenCalledWith(
      expect.objectContaining({ agent: "claude-code", agentId: "test-agent" }),
    );
    expect(agentEngine.run).not.toHaveBeenCalled();
  });

  it("forwards all options to agentEngine", async () => {
    const controller = new AbortController();
    await runAgent({
      ...baseOpts,
      jobId: "job-1",
      allowedTools: ["Read"],
      onProgress: vi.fn(),
      model: "gpt-5.6-luna",
      reasoningEffort: "high",
      speed: "priority",
      runtimeConfigId: "local-claude-code",
      executablePath: "C:\\Tools\\claude.cmd",
      signal: controller.signal,
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
        model: "gpt-5.6-luna",
        reasoningEffort: "high",
        speed: "priority",
        runtimeConfigId: "local-claude-code",
        executablePath: "C:\\Tools\\claude.cmd",
        signal: controller.signal,
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

  it("forwards the connector provider without resolving it", async () => {
    const getMcpConnectorInjection = vi.fn().mockResolvedValue(null);

    await runAgent({ ...baseOpts, getMcpConnectorInjection });

    expect(getMcpConnectorInjection).not.toHaveBeenCalled();
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({ getMcpConnectorInjection }),
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
