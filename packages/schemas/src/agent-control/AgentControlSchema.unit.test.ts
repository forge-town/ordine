import { describe, expect, it } from "vitest";
import {
  AgentApprovalSchema,
  AgentContextEnvelopeSchema,
  AgentControlEventSchema,
  AgentControlToolResultSchema,
} from ".";

describe("agent control schemas", () => {
  it("keeps route context compact and rejects embedded canvas snapshots", () => {
    const parsed = AgentContextEnvelopeSchema.parse({
      route: { pathname: "/canvas/pipeline-1" },
      pipelineId: "pipeline-1",
      capturedAt: "2026-08-25T00:00:00.000Z",
    });

    expect(parsed.selectedNodeIds).toEqual([]);
    expect(parsed).not.toHaveProperty("nodes");
    expect(parsed).not.toHaveProperty("edges");
  });

  it("requires an argument digest and expiry for irreversible approval", () => {
    expect(() =>
      AgentApprovalSchema.parse({
        id: "approval-1",
        threadId: "thread-1",
        runId: "run-1",
        actionId: "action-1",
        toolName: "ordine.delete_resource",
        callId: "call-1",
        argumentDigest: "not-a-digest",
        target: { type: "pipeline", id: "pipeline-1" },
        resourceVersion: 1,
        status: "pending",
        expiresAt: "2026-08-25T00:10:00.000Z",
        approvedAt: null,
        consumedAt: null,
        createdAt: "2026-08-25T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("validates compact successful action events", () => {
    const result = AgentControlToolResultSchema.parse({
      actionId: "action-1",
      status: "succeeded",
      summary: "Node added",
    });
    const event = AgentControlEventSchema.parse({
      type: "action_succeeded",
      runtime: "claude-code",
      timestamp: "2026-08-25T00:00:00.000Z",
      actionId: "action-1",
      result,
    });

    expect(result.resources).toEqual([]);
    expect(event.type).toBe("action_succeeded");
  });
});
