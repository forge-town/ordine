import { describe, expect, it } from "vitest";
import { DecisionNodeDataSchema } from "./DecisionNodeDataSchema";

const baseDecisionNodeData = {
  label: "Pick a design",
  nodeType: "decision",
  selectMode: "single",
};

describe("DecisionNodeDataSchema", () => {
  it("parses a minimal single-select decision node", () => {
    const parsed = DecisionNodeDataSchema.parse(baseDecisionNodeData);

    expect(parsed.selectMode).toBe("single");
    expect(parsed.instruction).toBeUndefined();
  });

  it("parses multi-select with an instruction", () => {
    const parsed = DecisionNodeDataSchema.parse({
      ...baseDecisionNodeData,
      selectMode: "multi",
      instruction: "Keep the two strongest variants.",
    });

    expect(parsed.selectMode).toBe("multi");
    expect(parsed.instruction).toBe("Keep the two strongest variants.");
  });

  it("rejects an unknown select mode", () => {
    expect(() =>
      DecisionNodeDataSchema.parse({ ...baseDecisionNodeData, selectMode: "auto" }),
    ).toThrow();
  });
});
