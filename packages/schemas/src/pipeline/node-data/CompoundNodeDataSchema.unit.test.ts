import { describe, expect, it } from "vitest";
import { CompoundNodeDataSchema } from "./CompoundNodeDataSchema";

describe("CompoundNodeDataSchema backward compatibility", () => {
  it("parses legacy payloads without compoundKind/childEdges", () => {
    const parsed = CompoundNodeDataSchema.parse({
      label: "Verify quiz",
      nodeType: "compound",
      childNodeIds: ["a", "b"],
      description: "legacy compound",
    });
    expect(parsed.compoundKind).toBeUndefined();
    expect(parsed.childEdges).toBeUndefined();
  });

  it("parses a verify compound with config and child edges", () => {
    const parsed = CompoundNodeDataSchema.parse({
      label: "Verify",
      nodeType: "compound",
      compoundKind: "verify",
      childNodeIds: ["v0", "vg", "vc", "vgate", "vout"],
      childEdges: [{ id: "ve0", source: "v0", target: "vg", data: { label: "candidate" } }],
      verifyConfig: { maxRounds: 3, criteria: "All answers must cite the source text." },
    });
    expect(parsed.compoundKind).toBe("verify");
    expect(parsed.childEdges).toHaveLength(1);
    expect(parsed.verifyConfig?.maxRounds).toBe(3);
  });

  it("rejects unknown compound kinds", () => {
    const result = CompoundNodeDataSchema.safeParse({
      label: "X",
      nodeType: "compound",
      compoundKind: "swarm",
      childNodeIds: [],
    });
    expect(result.success).toBe(false);
  });
});
