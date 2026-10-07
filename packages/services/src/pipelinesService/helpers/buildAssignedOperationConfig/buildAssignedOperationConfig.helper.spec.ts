import { describe, expect, it } from "vitest";
import { buildAssignedOperationConfig } from "./buildAssignedOperationConfig.helper";
import { PerStepCapabilityAssignmentSchema } from "../../contracts";
describe("buildAssignedOperationConfig", () => {
  it("retains the Pipeline content and error boundary", () => {
    const assignment = PerStepCapabilityAssignmentSchema.parse({
      operationId: "op-1",
      executor: {
        type: "script",
        language: "bash",
        command: "echo done",
        assignmentReason: "Deterministic local output needs no external capability.",
      },
    });
    const config = buildAssignedOperationConfig(assignment);
    expect(config.executor).toBe(assignment.executor);
    expect(config.inputs).toEqual([]);
    expect(config.outputs).toEqual([
      { name: "result", contentType: "markdown", description: "Generated result", templateIds: [] },
    ]);
  });
});
