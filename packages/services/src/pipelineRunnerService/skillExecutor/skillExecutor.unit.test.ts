import { describe, expect, it, vi, beforeEach } from "vitest";
import { agentEngine } from "@repo/agent-engine";

vi.mock("@repo/agent", () => ({
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

vi.mock("@repo/agent-engine", () => ({
  agentEngine: {
    run: vi.fn().mockResolvedValue({
      text: '{"type":"check","summary":"ok","findings":[],"stats":{"totalFiles":1,"totalFindings":0,"errors":0,"warnings":0,"infos":0,"skipped":0}}',
      events: [],
    }),
  },
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok result when claude succeeds", async () => {
    const result = await skillExecutor.run({ ...baseOpts, agent: "claude-code" });
    expect(result.isOk()).toBe(true);
  });

  it("returns SkillExecutionError when claude fails", async () => {
    vi.mocked(agentEngine.run).mockRejectedValueOnce(new Error("spawn failed"));
    const result = await skillExecutor.run({ ...baseOpts, agent: "claude-code" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("spawn failed");
    }
  });

  it("returns SkillExecutionError when claude returns empty output", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({
      text: "",
      events: [],
    });
    const result = await skillExecutor.run({ ...baseOpts, agent: "claude-code" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("empty output");
    }
  });

  it("returns SkillExecutionError when codex fails", async () => {
    vi.mocked(agentEngine.run).mockRejectedValueOnce(new Error("codex boom"));
    const result = await skillExecutor.run({ ...baseOpts, agent: "codex" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("codex boom");
    }
  });

  it("forwards jobId and agentId to agentEngine", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({
      text: '{"type":"check","summary":"ok","findings":[],"stats":{"totalFiles":1,"totalFindings":0,"errors":0,"warnings":0,"infos":0,"skipped":0}}',
      events: [],
    });

    const result = await skillExecutor.run({
      ...baseOpts,
      agent: "codex",
      jobId: "job-1",
    });

    expect(result.isOk()).toBe(true);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentId: "test-skill",
      }),
    );
  });

  it("returns SkillExecutionError for unsupported agent backend", async () => {
    vi.mocked(agentEngine.run).mockRejectedValueOnce(
      new Error('Unsupported agent backend: "unknown-agent"'),
    );
    const result = await skillExecutor.run({
      ...baseOpts,
      // @ts-expect-error -- testing unsupported agent
      agent: "unknown-agent",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SkillExecutionError);
      expect(result.error.message).toContain("unknown-agent");
    }
  });
});
