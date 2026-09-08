import { describe, expect, it } from "vitest";
import { JobExpiryContextSchema } from "./JobExpiryContextSchema";

describe("JobExpiryContextSchema", () => {
  it("accepts structured lease expiry evidence", () => {
    expect(
      JobExpiryContextSchema.parse({
        reason: "lease_expired",
        previousStatus: "paused",
        observedAtMs: 1_788_091_200_000,
        staleBeforeMs: 1_788_091_200_000,
        timeoutMs: null,
        sweeperId: "server:worker-1",
      }),
    ).toEqual(expect.objectContaining({ reason: "lease_expired", previousStatus: "paused" }));
  });

  it("rejects unsupported reasons and non-positive configured timeouts", () => {
    expect(() =>
      JobExpiryContextSchema.parse({
        reason: "absolute_runtime_timeout",
        previousStatus: "running",
        observedAtMs: 1,
        staleBeforeMs: 0,
        timeoutMs: 60_000,
        sweeperId: "server:worker-1",
      }),
    ).toThrow();
    expect(() =>
      JobExpiryContextSchema.parse({
        reason: "queue_timeout",
        previousStatus: "queued",
        observedAtMs: 1,
        staleBeforeMs: 0,
        timeoutMs: 0,
        sweeperId: "server:worker-1",
      }),
    ).toThrow();
  });
});
