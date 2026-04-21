import { describe, expect, it, vi, beforeEach } from "vitest";
import { runClaudeTmux, runCodexTmux, type SettingsResolver } from "@repo/agent";
import { recordAgentRunWithSpans } from "@repo/obs";

vi.mock("@repo/agent", () => ({
  runClaudeTmux: vi.fn().mockResolvedValue({
    text: '{"type":"check","summary":"ok","findings":[],"stats":{"totalFiles":1,"totalFindings":0,"errors":0,"warnings":0,"infos":0,"skipped":0}}',
    events: [],
    sessionName: "mock-session",
  }),
  runCodexTmux: vi.fn().mockResolvedValue({ output: "codex-output", sessionName: "mock-session" }),
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

vi.mock("../structuredOutput", () => ({
  structuredOutput: {
    extract: vi.fn((t: string) => t),
  },
}));

import { skillExecutor, SkillExecutionError } from ".";

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
    const result = await skillExecutor.run({ ...baseOpts, agent: "local-claude" });
    expect(result.isOk()).toBe(true);
  });

  it("returns SkillExecutionError when claude fails", async () => {
    vi.mocked(runClaudeTmux).mockRejectedValueOnce(new Error("spawn failed"));
    const result = await skillExecutor.run({ ...baseOpts, agent: "local-claude" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("spawn failed");
    }
  });

  it("returns SkillExecutionError when claude returns empty output", async () => {
    vi.mocked(runClaudeTmux).mockResolvedValueOnce({
      text: "",
      events: [],
      sessionName: "mock-session",
    });
    const result = await skillExecutor.run({ ...baseOpts, agent: "local-claude" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("empty output");
    }
  });

  it("returns SkillExecutionError when codex fails", async () => {
    vi.mocked(runCodexTmux).mockRejectedValueOnce(new Error("codex boom"));
    const result = await skillExecutor.run({ ...baseOpts, agent: "codex" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("codex boom");
    }
  });

  it("records an agent run for codex skills when jobId is provided", async () => {
    vi.mocked(runCodexTmux).mockResolvedValueOnce({
      output:
        '{"type":"check","summary":"ok","findings":[],"stats":{"totalFiles":1,"totalFindings":0,"errors":0,"warnings":0,"infos":0,"skipped":0}}',
      sessionName: "mock-session",
    });

    const result = await skillExecutor.run({
      ...baseOpts,
      agent: "codex",
      jobId: "job-1",
    });

    expect(result.isOk()).toBe(true);
    expect(recordAgentRunWithSpans).toHaveBeenCalledOnce();
    expect(recordAgentRunWithSpans).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentSystem: "codex",
        agentId: "test-skill",
        rawPayload: expect.objectContaining({
          system: expect.any(String),
          prompt: expect.any(String),
          output: expect.stringContaining('"summary":"ok"'),
        }),
        status: "completed",
      }),
      expect.any(Function),
    );
  });

  it("returns SkillExecutionError for unsupported agent backend", async () => {
    const result = await skillExecutor.run({
      ...baseOpts,
      agent: "unknown-agent" as "local-claude",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("Unsupported agent backend");
    }
  });
});
