import { describe, expect, it, vi, beforeEach } from "vitest";
import { runClaude, runCodex, type SettingsResolver } from "@repo/agent";

vi.mock("@repo/agent", () => ({
  runClaude: vi
    .fn()
    .mockResolvedValue({
      text: '{"type":"check","summary":"ok","findings":[],"stats":{"totalFiles":1,"totalFindings":0,"errors":0,"warnings":0,"infos":0,"skipped":0}}',
      events: [],
    }),
  runCodex: vi.fn().mockResolvedValue("codex-output"),
  getModel: vi.fn().mockResolvedValue(null),
  extractJsonFromText: vi.fn((t: string) => t),
  READ_ONLY_TOOLS: ["Read", "Bash"],
  WRITE_TOOLS: ["Read", "Write", "Bash"],
  CHECK_OUTPUT_EXAMPLE: {},
  FIX_OUTPUT_EXAMPLE: {},
  CheckOutputSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
  FixOutputSchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  ToolNameSchema: {
    array: () => ({ readonly: () => ({ safeParse: vi.fn().mockReturnValue({ success: false }) }) }),
  },
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@repo/obs", () => ({
  recordAgentRunWithSpans: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

vi.mock("./structuredOutput.js", () => ({
  extractStructuredOutput: vi.fn((t: string) => t),
}));

import { runSkill, SkillExecutionError } from "./skillExecutor";

describe("skillExecutor", () => {
  const baseOpts = {
    skillId: "test-skill",
    skillDescription: "A test skill",
    inputContent: "some code",
    inputPath: "/tmp/test",
    getSettings: vi.fn() as unknown as SettingsResolver,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok result when claude succeeds", async () => {
    const result = await runSkill({ ...baseOpts, agent: "local-claude" });
    expect(result.isOk()).toBe(true);
  });

  it("returns SkillExecutionError when claude fails", async () => {
    vi.mocked(runClaude).mockRejectedValueOnce(new Error("spawn failed"));
    const result = await runSkill({ ...baseOpts, agent: "local-claude" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("spawn failed");
    }
  });

  it("returns SkillExecutionError when claude returns empty output", async () => {
    vi.mocked(runClaude).mockResolvedValueOnce({ text: "", events: [] });
    const result = await runSkill({ ...baseOpts, agent: "local-claude" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("empty output");
    }
  });

  it("returns SkillExecutionError when codex fails", async () => {
    vi.mocked(runCodex).mockRejectedValueOnce(new Error("codex boom"));
    const result = await runSkill({ ...baseOpts, agent: "codex" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("codex boom");
    }
  });

  it("returns SkillExecutionError when no LLM model for mastra", async () => {
    const result = await runSkill({ ...baseOpts, agent: "mastra" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("No LLM model configured");
    }
  });
});
