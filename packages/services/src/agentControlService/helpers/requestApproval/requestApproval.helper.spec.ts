import { describe, expect, it, vi } from "vitest";
import { createRequestApprovalHelper } from "./requestApproval.helper";

import { findAgentControlTool } from "@repo/agent-control";
describe("requestApproval", () => {
  it("retains the Agent Control contract boundary", async () => {
    const requestApproval = vi.fn().mockImplementation(async ({ action, approval }) => ({
      action,
      approval: { ...approval, argumentDigest: "different" },
      created: false,
    }));
    const result = await createRequestApprovalHelper({
      repository: { requestApproval },
      emit: vi.fn(),
    } as never)({
      actionId: "action-1",
      definition: findAgentControlTool("ordine.delete_resource")!,
      input: { callId: "call-1" },
      threadId: "thread-1",
      runId: null,
      target: null,
      redactedInput: {},
      reasons: [],
    });
    expect(result).toMatchObject({
      status: "failed",
      retry: { code: "IDEMPOTENCY_ARGUMENT_MISMATCH", retryable: false },
    });
  });
});
