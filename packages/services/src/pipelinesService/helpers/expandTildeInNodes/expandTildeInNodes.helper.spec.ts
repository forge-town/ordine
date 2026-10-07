import { describe, expect, it } from "vitest";
import { expandTildeInNodes } from "./expandTildeInNodes.helper";
import { homedir } from "node:os";
import { PipelineSchema } from "@repo/schemas";
describe("expandTildeInNodes", () => {
  it("retains the Pipeline content and error boundary", () => {
    const nodes = PipelineSchema.shape.nodes.parse([
      {
        id: "input",
        type: "folder",
        position: { x: 0, y: 0 },
        data: { label: "Input", nodeType: "folder", folderPath: "~" },
      },
    ]);
    const expanded = expandTildeInNodes(nodes);
    expect(expanded[0]?.data).toMatchObject({ folderPath: homedir() });
    expect(nodes[0]?.data).toMatchObject({ folderPath: "~" });
  });
});
