import { describe, expect, it, vi } from "vitest";
import { createEnsureActivityProjectionHelper } from "./ensureActivityProjection.helper";
describe("ensureActivityProjection", () => {
  it("rebuilds a legacy read projection without mutating the persisted record", async () => {
    const record = {
      id: "run-1",
      runtime: "codex",
      status: "queued",
      activitySnapshot: null,
      activityMetrics: null,
      runtimeCapabilities: null,
      usage: null,
      resultText: null,
      errorCode: null,
      finishedAt: null,
    };
    const project = createEnsureActivityProjectionHelper({
      eventsDao: { findManyByRunIdAfter: vi.fn().mockResolvedValue([]) },
    } as never);
    const result = await project(record as never);
    expect(result.activitySnapshot).toMatchObject({
      runId: "run-1",
      runtime: "codex",
      status: "queued",
    });
    expect(result.activityMetrics).toMatchObject({ eventCount: 0, bytes: 0 });
    expect(record.activitySnapshot).toBeNull();
    expect(record.activityMetrics).toBeNull();
  });
});
