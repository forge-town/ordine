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

  it("keeps the bare operation prompt without runtime context", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });

    expect(result.isOk()).toBe(true);
    const callArgs = vi.mocked(agentEngine.run).mock.calls[0]![0];
    expect(callArgs.systemPrompt).toContain("Analyze this");
    expect(callArgs.systemPrompt).not.toContain("## Runtime Context");
  });
});
