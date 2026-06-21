import { describe, expect, it } from "vitest";
import {
  LegacyNodeRunStatusSchema,
  LenientNodeRunStatusSchema,
  NODE_RUN_STATUS_ENUM,
  NodeRunStatusSchema,
  normalizeNodeRunStatus,
} from "./NodeRunStatusSchema";

describe("NodeRunStatusSchema", () => {
  it("accepts all 9 states", () => {
    for (const value of Object.values(NODE_RUN_STATUS_ENUM)) {
      expect(NodeRunStatusSchema.parse(value)).toBe(value);
    }
  });

  it("rejects legacy values on the strict schema", () => {
    expect(NodeRunStatusSchema.safeParse("pass").success).toBe(false);
    expect(NodeRunStatusSchema.safeParse("fail").success).toBe(false);
  });
});

describe("normalizeNodeRunStatus", () => {
  it("maps legacy pass to done", () => {
    expect(normalizeNodeRunStatus("pass")).toBe("done");
  });

  it("maps legacy fail to failed", () => {
    expect(normalizeNodeRunStatus("fail")).toBe("failed");
  });

  it("passes through current values unchanged", () => {
    for (const value of Object.values(NODE_RUN_STATUS_ENUM)) {
      expect(normalizeNodeRunStatus(value)).toBe(value);
    }
  });

  it("falls back to idle for unknown values", () => {
    expect(normalizeNodeRunStatus("definitely-not-a-status")).toBe("idle");
  });
});

describe("LegacyNodeRunStatusSchema", () => {
  it("maps pass to done and fail to failed", () => {
    expect(LegacyNodeRunStatusSchema.parse("pass")).toBe("done");
    expect(LegacyNodeRunStatusSchema.parse("fail")).toBe("failed");
  });

  it("passes through legacy idle and running values", () => {
    expect(LegacyNodeRunStatusSchema.parse("idle")).toBe("idle");
    expect(LegacyNodeRunStatusSchema.parse("running")).toBe("running");
  });
});

describe("LenientNodeRunStatusSchema", () => {
  it("normalizes legacy persisted data", () => {
    expect(LenientNodeRunStatusSchema.parse("pass")).toBe("done");
    expect(LenientNodeRunStatusSchema.parse("fail")).toBe("failed");
    expect(LenientNodeRunStatusSchema.parse("running")).toBe("running");
  });
});
