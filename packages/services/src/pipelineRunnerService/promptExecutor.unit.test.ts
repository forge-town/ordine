import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SettingsResolver } from "@repo/agent";

vi.mock("@repo/agent", () => ({
  runClaude: vi.fn().mockResolvedValue({ text: "claude-output" }),
  runCodex: vi.fn().mockResolvedValue("codex-output"),
  getModel: vi.fn().mockResolvedValue(null),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

import { runPrompt } from "./promptExecutor";
import { runClaude, runCodex } from "@repo/agent";

describe("promptExecutor", () => {
  const baseOpts = {
    prompt: "Analyze this",
    inputContent: "some code",
    inputPath: "/tmp/test",
    getSettings: vi.fn() as unknown as SettingsResolver,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches to runClaude when agent is local-claude", async () => {
    const result = await runPrompt({ ...baseOpts, agent: "local-claude" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("claude-output");
    expect(runClaude).toHaveBeenCalledOnce();
  });

  it("dispatches to runCodex when agent is codex", async () => {
    const result = await runPrompt({ ...baseOpts, agent: "codex" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("codex-output");
    expect(runCodex).toHaveBeenCalledOnce();
    expect(runCodex).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "Analyze this",
        userPrompt: "some code",
        cwd: "/tmp/test",
      }),
    );
  });

  it("returns error for empty prompt", async () => {
    const result = await runPrompt({ ...baseOpts, prompt: "  " });
    expect(result.isErr()).toBe(true);
  });
});
