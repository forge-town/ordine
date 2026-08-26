import { describe, expect, it } from "vitest";
import { digestAgentControlArguments } from "./createAgentControlService";

describe("Agent Control idempotency argument digest", () => {
  it("ignores retry metadata while binding the semantic tool arguments", () => {
    const initial = digestAgentControlArguments({
      callId: "call-1",
      threadId: "thread-1",
      runId: "run-1",
      pipelineId: "pipeline-1",
      nodeId: "node-1",
      patch: { label: "First" },
    });
    const resumed = digestAgentControlArguments({
      callId: "call-1",
      approvalRequestId: "approval-1",
      threadId: "thread-1",
      runId: "run-2",
      changeSetId: "change-set-1",
      pipelineId: "pipeline-1",
      nodeId: "node-1",
      patch: { label: "First" },
    });
    const changed = digestAgentControlArguments({
      callId: "call-1",
      threadId: "thread-1",
      runId: "run-2",
      pipelineId: "pipeline-1",
      nodeId: "node-1",
      patch: { label: "Changed" },
    });

    expect(resumed).toBe(initial);
    expect(changed).not.toBe(initial);
  });
});
