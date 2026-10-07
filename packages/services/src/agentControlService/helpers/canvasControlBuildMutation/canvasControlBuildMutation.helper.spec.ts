import { describe, expect, it } from "vitest";
import { buildMutation } from "./canvasControlBuildMutation.helper";

import { RemoveNodeInputSchema } from "@repo/agent-control";
describe("canvasControlBuildMutation", () => {
  it("retains the Agent Control contract boundary", () => {
    const input = RemoveNodeInputSchema.parse({
      pipelineId: "pipeline-1",
      threadId: "thread-1",
      callId: "call-1",
      nodeId: "missing",
    });
    const result = buildMutation("ordine.remove_node", input, { nodes: [], edges: [] }, "action-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "NODE_NOT_FOUND", nodeId: "missing" });
  });
});
