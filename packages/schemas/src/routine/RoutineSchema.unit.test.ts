import { describe, expect, it } from "vitest";
import { CreateRoutineSchema, RoutineSchema, UpdateRoutineSchema } from "./RoutineSchema";
import { JobStatusSchema } from "../job";

const baseRoutine = {
  id: "routine-1",
  pipelineId: "pipeline-1",
  name: "Nightly",
  description: "Runs the nightly pipeline",
  cronExpression: "0 0 * * *",
  inputConfig: null,
  enabled: true,
  lastRunAt: null,
  nextRunAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("RoutineSchema", () => {
  it("accepts a cron routine with description", () => {
    const parsed = RoutineSchema.parse(baseRoutine);
    expect(parsed.description).toBe("Runs the nightly pipeline");
    expect(parsed.cronExpression).toBe("0 0 * * *");
  });

  it("accepts a null description", () => {
    expect(RoutineSchema.parse({ ...baseRoutine, description: null }).description).toBeNull();
  });

  it("rejects an enabled routine without a cron expression", () => {
    const result = RoutineSchema.safeParse({ ...baseRoutine, cronExpression: null });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed cron expression", () => {
    const result = RoutineSchema.safeParse({ ...baseRoutine, cronExpression: "not a cron" });
    expect(result.success).toBe(false);
  });

  it("accepts a disabled routine without a cron expression", () => {
    const result = RoutineSchema.safeParse({
      ...baseRoutine,
      cronExpression: null,
      enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("no longer exposes event trigger fields", () => {
    const parsed = RoutineSchema.parse({
      ...baseRoutine,
      triggerType: "event",
      eventType: "webhook",
      eventConfig: { url: "http://example.com" },
    });
    expect(parsed).not.toHaveProperty("triggerType");
    expect(parsed).not.toHaveProperty("eventType");
    expect(parsed).not.toHaveProperty("eventConfig");
  });
});

describe("CreateRoutineSchema", () => {
  it("defaults enabled to true and requires cron in that case", () => {
    const missingCron = CreateRoutineSchema.safeParse({
      pipelineId: "pipeline-1",
      name: "Nightly",
    });
    expect(missingCron.success).toBe(false);

    const withCron = CreateRoutineSchema.parse({
      pipelineId: "pipeline-1",
      name: "Nightly",
      cronExpression: "*/5 * * * *",
    });
    expect(withCron.enabled).toBe(true);
    expect(withCron.description).toBeUndefined();
  });
});

describe("UpdateRoutineSchema", () => {
  it("validates cron when the schedule is touched", () => {
    expect(UpdateRoutineSchema.safeParse({ cronExpression: "bogus" }).success).toBe(false);
    expect(UpdateRoutineSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(UpdateRoutineSchema.safeParse({ description: "New description" }).success).toBe(true);
  });
});

describe("JobStatusSchema", () => {
  it("accepts the skipped status for routine history entries", () => {
    expect(JobStatusSchema.parse("skipped")).toBe("skipped");
  });
});
