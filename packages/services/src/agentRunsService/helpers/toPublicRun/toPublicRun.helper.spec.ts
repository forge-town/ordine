import { describe, expect, it } from "vitest";
import { toPublicRun } from "./toPublicRun.helper";
describe("toPublicRun", () => {
  it("retains run ownership and serializes persisted dates for the public boundary", () => {
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
    const result = toPublicRun(record as never);
    expect(result.owner).toEqual({ type: "test", id: "owner-1" });
    expect(result.createdAt).toBe(new Date(0).toISOString());
    expect(result.finishedAt).toBe(new Date(0).toISOString());
    expect(result).not.toHaveProperty("ownerType");
  });
});
