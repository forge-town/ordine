import { describe, expect, it } from "vitest";
import { PipelineEdgeDataSchema } from "./PipelineEdgeDataSchema";

describe("PipelineEdgeDataSchema backward compatibility", () => {
  it("parses legacy `{ label }` payloads", () => {
    const parsed = PipelineEdgeDataSchema.parse({ label: "vocabulary" });
    expect(parsed.label).toBe("vocabulary");
    expect(parsed.dataContract).toBeUndefined();
  });

  it("parses empty payloads with label defaulting", () => {
    const parsed = PipelineEdgeDataSchema.parse({});
    expect(parsed.label).toBe("");
  });

  it("parses a full data contract", () => {
    const parsed = PipelineEdgeDataSchema.parse({
      label: "vocabulary, grammar",
      dataContract: {
        mappings: [
          { fromField: "vocabulary", toInput: "source_terms", type: "Term[]", enabled: true },
          { fromField: "text_blocks", toInput: "—", enabled: false },
        ],
      },
    });
    expect(parsed.dataContract?.mappings).toHaveLength(2);
    expect(parsed.dataContract?.mappings[0]?.enabled).toBe(true);
  });

  it("parses reserved condition/transform/qualityGate fields", () => {
    const parsed = PipelineEdgeDataSchema.parse({
      label: "risk routing",
      condition: { expression: "has_risk == true", fallbackTarget: "node-out" },
      transform: { steps: [{ type: "rename", config: { from: "a", to: "b" } }] },
      qualityGate: { criteria: "schema valid", maxRetries: 2, onFail: "retry" },
    });
    expect(parsed.condition?.expression).toBe("has_risk == true");
    expect(parsed.qualityGate?.onFail).toBe("retry");
  });
});
