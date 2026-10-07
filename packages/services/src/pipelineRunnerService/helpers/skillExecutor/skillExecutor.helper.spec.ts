import { mkdtempSync, rmSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";

vi.mock("@repo/agent", () => ({
  extractJsonFromText: vi.fn((t: string) => t),
  READ_ONLY_TOOLS: ["Read", "Bash"],
  WRITE_TOOLS: ["Read", "Write", "Bash"],
  CheckOutputSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
  FixOutputSchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  ToolNameSchema: {
    array: vi.fn(() => ({
      readonly: () => ({ safeParse: vi.fn().mockReturnValue({ success: false }) }),
    })),
  },
}));

vi.mock("@repo/agent-engine", () => ({
  agentEngine: {
    run: vi.fn().mockResolvedValue({
      text: '{"type":"check","summary":"ok","findings":[],"stats":{"totalFiles":1,"totalFindings":0,"errors":0,"warnings":0,"infos":0,"skipped":0}}',
      usage: null,
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

import { skillExecutor } from "./";

// A real directory: resolveCwd rejects explicitly configured paths that do not exist.
const inputDir = mkdtempSync(join(tmpdir(), "skill-executor-test-"));

afterAll(() => {
  rmSync(inputDir, { recursive: true, force: true });
});

describe("skillExecutor", () => {
  const baseOpts = {
    skillId: "test-skill",
    skillDescription: "A test skill",
    inputContent: "some code",
    inputPath: inputDir,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok result when claude succeeds", async () => {
    const result = await skillExecutor.run({ ...baseOpts, agent: "claude-code" });
    expect(result.isOk()).toBe(true);
  });
});
