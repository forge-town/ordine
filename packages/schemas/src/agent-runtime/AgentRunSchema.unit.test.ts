import { describe, expect, it } from "vitest";
import { AgentRunSchema } from "./AgentRunSchema";

describe("AgentRunSchema", () => {
  it("defaults execution choices for runs stored before the fields existed", () => {
    const run = AgentRunSchema.parse({
      id: "run-1",
      owner: { type: "pipeline-agent-session", id: "session-1" },
      runtimeConfigId: "local-codex",
      runtime: "codex",
      status: "completed",
      executablePath: "C:\\bin\\codex.exe",
      executableVersion: "1.0.0",
      executableFingerprint: "hash",
      model: null,
      cwd: "C:\\repo",
      nativeSessionId: null,
      resumeFromRunId: null,
      permissionMode: "workspace-write",
      networkAccess: true,
      usage: null,
      resultText: "done",
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-08-22T00:00:00.000Z",
      startedAt: "2026-08-22T00:00:00.000Z",
      firstOutputAt: "2026-08-22T00:00:01.000Z",
      lastActivityAt: "2026-08-22T00:00:01.000Z",
      finishedAt: "2026-08-22T00:00:02.000Z",
    });

    expect(run.reasoningEffort).toBeNull();
    expect(run.speed).toBeNull();
  });
});
