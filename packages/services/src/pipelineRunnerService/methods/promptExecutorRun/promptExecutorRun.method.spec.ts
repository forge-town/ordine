import { mkdtempSync, rmSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";

import { agentEngine } from "@repo/agent-engine";

vi.mock("@repo/agent", () => ({}));

vi.mock("@repo/agent-engine", () => ({
  agentEngine: {
    run: vi.fn().mockResolvedValue({ text: "claude-output", usage: null }),
  },
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

import { promptExecutor } from "../../helpers/promptExecutor";

// A real directory: resolveCwd rejects explicitly configured paths that do not exist.
const inputDir = mkdtempSync(join(tmpdir(), "prompt-executor-test-"));

afterAll(() => {
  rmSync(inputDir, { recursive: true, force: true });
});

describe("promptExecutor", () => {
  const baseOpts = {
    prompt: "Analyze this",
    inputContent: "some code",
    inputPath: inputDir,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentEngine.run).mockResolvedValue({ text: "claude-output", usage: null });
  });

  it("dispatches to agentEngine when agent is claude-code", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "claude-code" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("claude-output");
    expect(agentEngine.run).toHaveBeenCalledOnce();
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({ agent: "claude-code", mode: "direct" }),
    );
  });

  it("dispatches to agentEngine when agent is codex", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({ text: "codex-output", usage: null });
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("codex-output");
    expect(agentEngine.run).toHaveBeenCalledOnce();
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
        mode: "direct",
        systemPrompt: expect.stringContaining("Analyze this"),
        userPrompt: "some code",
        cwd: inputDir,
      }),
    );
  });

  it("forwards accumulated runtime text to the pipeline chunk callback", async () => {
    vi.mocked(agentEngine.run).mockImplementationOnce(async (options) => {
      await options.onTextDelta?.("first");
      await options.onTextDelta?.(" second");

      return { text: "first second", usage: null };
    });
    const onChunk = vi.fn();

    const result = await promptExecutor.run({ ...baseOpts, agent: "codex", onChunk });

    expect(result.isOk()).toBe(true);
    expect(onChunk).toHaveBeenNthCalledWith(1, "first");
    expect(onChunk).toHaveBeenNthCalledWith(2, "first second");
  });

  it("falls back to process.cwd() when no inputPath is configured", async () => {
    const result = await promptExecutor.run({ ...baseOpts, inputPath: "", agent: "codex" });

    expect(result.isOk()).toBe(true);
    expect(agentEngine.run).toHaveBeenCalledWith(expect.objectContaining({ cwd: process.cwd() }));
  });

  it("fails the node when the configured inputPath does not exist", async () => {
    const result = await promptExecutor.run({
      ...baseOpts,
      inputPath: "/nope/does/not/exist",
      agent: "codex",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("/nope/does/not/exist");
    }
    expect(agentEngine.run).not.toHaveBeenCalled();
  });

  it("forwards jobId and agentId to agentEngine", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({ text: "codex-output", usage: null });

    const result = await promptExecutor.run({
      ...baseOpts,
      agent: "codex",
      jobId: "job-1",
    });

    expect(result.isOk()).toBe(true);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentId: "prompt-executor",
      }),
    );
  });

  it("always appends the missing-configuration user-action instructions", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });

    expect(result.isOk()).toBe(true);
    const callArgs = vi.mocked(agentEngine.run).mock.calls[0]![0];
    expect(callArgs.systemPrompt).toContain("## When user-side configuration is missing");
    expect(callArgs.systemPrompt).toContain("@@USER_ACTION::");
  });

  it("requires content-preserving operations to return a complete downstream artifact", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });

    expect(result.isOk()).toBe(true);
    const callArgs = vi.mocked(agentEngine.run).mock.calls[0]![0];
    expect(callArgs.systemPrompt).toContain("## Downstream data contract");
    expect(callArgs.systemPrompt).toContain("return the COMPLETE resulting artifact");
    expect(callArgs.systemPrompt).toContain(
      "Do not replace usable input content with placeholders",
    );
  });

  it("forwards selected MCP tools for prompt operations", async () => {
    const result = await promptExecutor.run({
      ...baseOpts,
      agent: "codex",
      allowedTools: ["Read", "mcp__github__read_issue"],
      extraTools: ["Read"],
    });

    expect(result.isOk()).toBe(true);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({ allowedTools: ["Read", "mcp__github__read_issue"] }),
    );
  });
});
