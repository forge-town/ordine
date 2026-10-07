import { describe, expect, it } from "vitest";
import type { PipelineNode } from "@repo/schemas";
import { toInputSlots } from "./toInputSlots.helper";
describe("toInputSlots", () => {
  it("exposes only object nodes as inputs in their original order", () => {
    const input: PipelineNode = {
      id: "prompt-1",
      type: "prompt",
      metaType: "object",
      position: { x: 0, y: 0 },
      data: { label: "Brief", nodeType: "prompt", prompt: "Write a brief" },
    };
    const output: PipelineNode = { ...input, id: "output-1", metaType: "output" };
    expect(toInputSlots([output, input])).toEqual([
      { nodeId: "prompt-1", label: "Brief", acceptTypes: ["prompt"] },
    ]);
  });
});
