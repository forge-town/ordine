import { describe, expect, it, vi } from "vitest";
import { AgentRunActivityMetricsSchema } from "@repo/schemas";
import type { AgentRunsServiceBindings } from "../../contracts";
import { createRecordActivityTelemetryMethod } from "./recordActivityTelemetry.method";

describe("recordActivityTelemetry", () => {
  it("persists the cumulative artifact-open failure count without mutating the read record", async () => {
    const run = {
      id: "run-1",
      activityMetrics: AgentRunActivityMetricsSchema.parse({ artifactOpenFailureCount: 2 }),
    };
    const update = vi
      .fn<AgentRunsServiceBindings["runsDao"]["update"]>()
      .mockImplementation(async (id, patch) => ({ ...run, id, ...patch }) as never);
    const telemetry = createRecordActivityTelemetryMethod({
      getRunRecord: vi.fn().mockResolvedValue(run),
      runsDao: { update },
      getPublicRun: vi.fn().mockImplementation(async (record) => record),
    } as never);
    const result = await telemetry("run-1", {
      kind: "artifact_open_failed",
    });
    expect(result.activityMetrics?.artifactOpenFailureCount).toBe(3);
    expect(run.activityMetrics.artifactOpenFailureCount).toBe(2);
  });
});
