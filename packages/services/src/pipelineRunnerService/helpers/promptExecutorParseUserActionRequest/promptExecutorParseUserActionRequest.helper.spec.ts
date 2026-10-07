import { UserActionRequiredError } from "@repo/pipeline-engine";

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

  it("fails instead of forwarding a valid user-action request as successful output", async () => {
    const onProgress = vi.fn();
    vi.mocked(agentEngine.run).mockResolvedValueOnce({
      text: [
        '@@USER_ACTION::{"kind":"provide-info","message":"Provide the final paper"}',
        "Partial answer",
      ].join("\n"),
      usage: null,
    });

    const result = await promptExecutor.run({ ...baseOpts, agent: "codex", onProgress });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(UserActionRequiredError);
      expect(result.error.message).toContain("Provide the final paper");
    }
    expect(onProgress).toHaveBeenCalledWith(
      '@@USER_ACTION::{"kind":"provide-info","message":"Provide the final paper"}',
    );
  });

  it("fails closed when an agent emits a malformed user-action request", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({
      text: "@@USER_ACTION::{not-json}",
      usage: null,
    });

    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("invalid user-action marker");
    }
  });
});
