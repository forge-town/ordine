import { describe, expect, it } from "vitest";
import { extractValidationIssues } from "./extractValidationIssues.helper";

describe("extractValidationIssues", () => {
  it("preserves catalog validation and presentation boundaries", () => {
    expect(extractValidationIssues({ inputs: [], outputs: [] }, [])).toEqual([]);
    expect(
      extractValidationIssues(
        {
          inputs: [],
          outputs: [],
          executor: { type: "agent", skillId: "missing", allowedTools: ["missing-tool"] },
        },
        [],
        "operations[2].config",
      ),
    ).toEqual([
      {
        path: "operations[2].config.executor.skillId",
        reference: "missing",
        expectedKinds: ["skill"],
      },
      {
        path: "operations[2].config.executor.allowedTools[0]",
        reference: "missing-tool",
        expectedKinds: ["builtin-tool", "mcp-tool"],
      },
    ]);
  });
});
