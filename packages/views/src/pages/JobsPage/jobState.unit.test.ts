import { describe, expect, it } from "vitest";
import { ExecutionJobStateSchema } from "@repo/schemas";
import { jobActionsForState, jobStateFilter } from "./jobState";

describe("Jobs page v2 states", () => {
  it("accounts for all eleven protocol states without a legacy status alias", () => {
    expect(Object.keys(jobStateFilter).sort()).toEqual([...ExecutionJobStateSchema.options].sort());
    expect(jobStateFilter.waiting_for_input).toBe("Waiting");
    expect(jobStateFilter.cancelled).toBe("Cancelled");
    expect(jobStateFilter.interrupted).toBe("Failed");
  });
  it("does not offer rerun for an active or cancelling job", () => {
    expect(jobActionsForState("waiting_for_input")).toEqual(["cancel"]);
    expect(jobActionsForState("pausing")).toEqual(["cancel"]);
    expect(jobActionsForState("cancelling")).toEqual([]);
    expect(jobActionsForState("succeeded")).toEqual(["rerun"]);
  });
});
