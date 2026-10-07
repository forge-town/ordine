import { describe, expect, it } from "vitest";
import { capabilitySnapshotForRuntime } from "./capabilitySnapshotForRuntime.helper";

describe("capabilitySnapshotForRuntime", () => {
  it("retains the Agent Run boundary contract", () => {
    expect(capabilitySnapshotForRuntime("codex")).toMatchObject({
      textStreaming: expect.any(String),
      resume: expect.any(String),
      cancellation: expect.any(String),
    });
  });
});
