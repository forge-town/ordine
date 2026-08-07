import { describe, expect, it } from "vitest";
import {
  CreateRoutineSchema,
  RoutineOccurrencesInputSchema,
  RoutineSchema,
  UpdateRoutineSchema,
} from "./RoutineSchema";
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

  it("rejects a malformed cron expression even on a disabled routine", () => {
    const result = CreateRoutineSchema.safeParse({
      pipelineId: "pipeline-1",
      name: "Nightly",
      enabled: false,
      cronExpression: "bogus",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateRoutineSchema", () => {
  it("only checks the format of a provided cronExpression", () => {
    expect(UpdateRoutineSchema.safeParse({ cronExpression: "bogus" }).success).toBe(false);
    expect(UpdateRoutineSchema.safeParse({ cronExpression: "0 9 * * 1-5" }).success).toBe(true);
    expect(UpdateRoutineSchema.safeParse({ description: "New description" }).success).toBe(true);
    expect(UpdateRoutineSchema.safeParse({ enabled: false }).success).toBe(true);
    // The enabled/cron cross-check lives in routinesService.update, so a pure
    // enable toggle and clearing the expression are valid patches here.
    expect(UpdateRoutineSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(UpdateRoutineSchema.safeParse({ cronExpression: null }).success).toBe(true);
  });
});

describe("RoutineOccurrencesInputSchema", () => {
  it("accepts a seven-day occurrence window", () => {
    expect(
      RoutineOccurrencesInputSchema.safeParse({
        from: "2026-08-03T00:00:00.000Z",
        to: "2026-08-10T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects reversed and overlong occurrence windows", () => {
    expect(
      RoutineOccurrencesInputSchema.safeParse({
        from: "2026-08-10T00:00:00.000Z",
        to: "2026-08-03T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      RoutineOccurrencesInputSchema.safeParse({
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-10T00:00:00.001Z",
      }).success,
    ).toBe(false);
  });
});

describe("cron validity matrix (parser-backed)", () => {
  const withCron = (cronExpression: string) => ({ ...baseRoutine, cronExpression });

  it("accepts Sunday expressed as 7", () => {
    expect(RoutineSchema.safeParse(withCron("0 9 * * 7")).success).toBe(true);
  });

  it("rejects a zero step", () => {
    expect(RoutineSchema.safeParse(withCron("*/0 * * * *")).success).toBe(false);
  });

  it("rejects six fields", () => {
    expect(RoutineSchema.safeParse(withCron("0 9 * * 1 extra")).success).toBe(false);
  });

  it("rejects well-formed but unsatisfiable dates", () => {
    expect(RoutineSchema.safeParse(withCron("0 0 30 2 *")).success).toBe(false);
  });

  it("accepts leap-day expressions (search window covers the leap cycle)", () => {
    expect(RoutineSchema.safeParse(withCron("0 0 29 2 *")).success).toBe(true);
  });

  it("rejects inverted ranges", () => {
    expect(RoutineSchema.safeParse(withCron("0 9 * * 5-2")).success).toBe(false);
  });
});

describe("JobStatusSchema", () => {
  it("accepts the skipped status for routine history entries", () => {
    expect(JobStatusSchema.parse("skipped")).toBe("skipped");
  });
});
