import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAgent } = vi.hoisted(() => ({
  runAgent: vi.fn().mockResolvedValue(
    '{"type":"check","summary":"ok","findings":[],"stats":{"totalFiles":1,"totalFindings":0,"errors":0,"warnings":0,"infos":0,"skipped":0}}',
  ),
}));

vi.mock("../agentRunner/agentRunner", () => ({
  runAgent,
}));

vi.mock("@repo/agent", () => ({
  extractJsonFromText: vi.fn((t: string) => t),
  READ_ONLY_TOOLS: ["Read", "Bash"],
  WRITE_TOOLS: ["Read", "Write", "Bash"],
  CheckOutputSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
  FixOutputSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
  ToolNameSchema: {
    array: () => ({ readonly: () => ({ safeParse: vi.fn().mockReturnValue({ success: false }) }) }),
  },
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { DEFAULT_SKILL_SYSTEM_PROMPT, skillExecutor } from ".";

describe("skillExecutor systemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the default system prompt when no override is provided", async () => {
    const result = await skillExecutor.run({
      skillId: "s1",
      skillDescription: "desc",
      inputContent: "foo",
      inputPath: "/tmp/foo",
      agent: "claude-code",
      jobId: "j1",
    });

    expect(result.isOk()).toBe(true);
    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: DEFAULT_SKILL_SYSTEM_PROMPT,
      }),
    );
  });

  it("uses the provided system prompt override when present", async () => {
    const result = await skillExecutor.run({
      skillId: "s1",
      skillDescription: "desc",
      systemPrompt: "STRICT PROMPT",
      inputContent: "foo",
      inputPath: "/tmp/foo",
      agent: "claude-code",
      jobId: "j1",
    });

    expect(result.isOk()).toBe(true);
    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "STRICT PROMPT",
      }),
    );
  });
});
