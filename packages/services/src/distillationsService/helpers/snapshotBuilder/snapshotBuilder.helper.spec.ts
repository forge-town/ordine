import { describe, expect, it } from "vitest";
import { DistillationSchema } from "@repo/schemas";
import { buildSourceSnapshot } from "./snapshotBuilder.helper";
describe("buildSourceSnapshot", () => {
  it("retains manual source material without requiring DAO access", async () => {
    const distillation = DistillationSchema.parse({
      id: "distillation-1",
      title: "Manual notes",
      summary: "Evidence",
      sourceType: "manual",
      sourceId: null,
      sourceLabel: "Session",
      mode: "knowledge",
      status: "draft",
      config: { objective: "Keep useful facts" },
      inputSnapshot: { notes: "Original notes" },
      result: null,
    });
    const result = await buildSourceSnapshot({
      distillation,
      jobsDao: {} as never,
      jobTracesDao: {} as never,
      agentRawExportsDao: {} as never,
      agentSpansDao: {} as never,
      pipelinesDao: {} as never,
    });
    expect(result).toEqual({
      kind: "manual",
      sourceLabel: "Session",
      summary: "Evidence",
      objective: "Keep useful facts",
      existingInputSnapshot: { notes: "Original notes" },
    });
  });
});
