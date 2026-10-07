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

import { promptExecutor } from "../promptExecutor";

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

  it("injects structured runtime context into the system prompt", async () => {
    const result = await promptExecutor.run({
      ...baseOpts,
      agent: "codex",
      runtimeContext: {
        pipeline: {
          name: "Repository Review",
          description: "Review the whole repository",
          sharedContext: "Follow repository review standards",
        },
        operation: {
          name: "Summarize Findings",
          description: "Summarize all prior checks",
          instruction: "Analyze this",
        },
      },
    });

    expect(result.isOk()).toBe(true);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("## Runtime Context"),
      }),
    );
    const callArgs = vi.mocked(agentEngine.run).mock.calls[0]![0];
    expect(callArgs.systemPrompt).toContain("### Pipeline-global context");
    expect(callArgs.systemPrompt).toContain("Pipeline name: Repository Review");
    expect(callArgs.systemPrompt).toContain(
      "Pipeline shared context: Follow repository review standards",
    );
    expect(callArgs.systemPrompt).toContain("### Operation-local context");
    expect(callArgs.systemPrompt).toContain("Operation name: Summarize Findings");
    expect(callArgs.systemPrompt).toContain("## Operation Prompt");
    expect(callArgs.systemPrompt).toContain("Analyze this");
  });
});
