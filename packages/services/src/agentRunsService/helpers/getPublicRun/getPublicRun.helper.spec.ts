import { describe, expect, it, vi } from "vitest";
import { createGetPublicRunHelper } from "./getPublicRun.helper";
describe("getPublicRun", () => {
  it("returns the compatible activity projection before exposing the public record", async () => {
    const record = {
      id: "run-1",
      ownerType: "test",
      ownerId: "owner-1",
      runtimeConfigId: "runtime-1",
      runtime: "codex",
      status: "completed",
      executablePath: null,
      executableVersion: null,
      executableFingerprint: null,
      model: null,
      reasoningEffort: null,
      speed: null,
      cwd: "/workspace",
      nativeSessionId: null,
      resumeFromRunId: null,
      permissionMode: "read-only",
      networkAccess: false,
      controlMode: false,
      allowedTools: [],
      controlScopes: [],
      runtimeCapabilities: null,
      activitySnapshot: null,
      activityMetrics: null,
      usage: null,
      resultText: "done",
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      startedAt: null,
      firstOutputAt: null,
      lastActivityAt: null,
      finishedAt: new Date(0),
    };
    const projected = { ...record, resultText: "restored evidence" };
    const getPublic = createGetPublicRunHelper({
      ensureActivityProjection: vi.fn().mockResolvedValue(projected),
    });
    const result = await getPublic(record as never);
    expect(result.resultText).toBe("restored evidence");
    expect(record.resultText).toBe("done");
  });
});
