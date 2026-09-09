import { beforeEach, describe, expect, it } from "vitest";
import { RunRequestInputSchema, RunRequestReceiptSchema } from "@repo/schemas";
import { createExecutionWorkspaceStore } from "../pages/ExecutionWorkspacePage/_store/store";
const request = RunRequestInputSchema.parse({
  apiVersion: 2,
  requestId: "11111111-1111-4111-8111-111111111111",
  pipelineId: "pipeline-1",
  expectedRevision: 3,
  inputs: { input: [{ kind: "text", value: "private-input" }] },
});
const accepted = RunRequestReceiptSchema.parse({
  apiVersion: 2,
  requestId: request.requestId,
  preparedRunId: "prepared-1",
  state: "accepted",
  jobId: "job-1",
  acceptedAt: "2026-09-08T12:00:00Z",
});
beforeEach(() => sessionStorage.clear());
describe("execution submission recovery", () => {
  it("acquires an explicit request exactly once and blocks repeated clicks", () => {
    const store = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    expect(store.getState().startRequest(request)).toBe(true);
    expect(store.getState().startRequest({ ...request, requestId: crypto.randomUUID() })).toBe(
      false,
    );
    expect(store.getState().submission.request).toEqual(request);
  });
  it("retains the original request after uncertainty and recovers the same Job", () => {
    const store = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    store.getState().startRequest(request);
    store.getState().failRequest("Network timed out");
    expect(store.getState().submission).toMatchObject({ phase: "uncertain", request });
    expect(store.getState().startRequest({ ...request, requestId: crypto.randomUUID() })).toBe(
      false,
    );
    store.getState().acceptReceipt(accepted);
    expect(store.getState().selectedJobId).toBe("job-1");
    expect(store.getState().submission.phase).toBe("accepted");
  });
  it("does not select a Job from a mismatched receipt", () => {
    const store = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    store.getState().startRequest(request);
    store
      .getState()
      .acceptReceipt({ ...accepted, requestId: "22222222-2222-4222-8222-222222222222" });
    expect(store.getState().submission.phase).toBe("uncertain");
    expect(store.getState().selectedJobId).toBeNull();
  });
  it("restores recoverable identity after reload without persisting input content", () => {
    const store = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    store.getState().startRequest(request);
    expect(
      sessionStorage.getItem(
        `ordine.execution.v2.request:${encodeURIComponent("http://localhost:9433|workspace-1")}`,
      ),
    ).not.toContain("private-input");
    const restored = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    expect(restored.getState().submission).toMatchObject({
      phase: "uncertain",
      request: {
        requestId: request.requestId,
        pipelineId: request.pipelineId,
        expectedRevision: 3,
      },
    });
    restored.getState().resetRequest();
    expect(
      createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1").getState()
        .submission.phase,
    ).toBe("idle");
  });
  it("keeps awaiting approval separate from accepted execution", () => {
    const store = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    store.getState().startRequest(request);
    store.getState().acceptReceipt({
      apiVersion: 2,
      requestId: request.requestId,
      preparedRunId: "prepared-1",
      state: "awaiting_approval",
      approvalId: "approval-1",
      expiresAt: "2026-09-08T13:00:00Z",
    });
    expect(store.getState().submission.phase).toBe("awaiting_approval");
    expect(store.getState().selectedJobId).toBeNull();
  });
  it("isolates recovery identity by endpoint and workspace, independently from instance UUID", () => {
    const source = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    source.getState().startRequest(request);
    expect(
      createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-2").getState()
        .submission.phase,
    ).toBe("idle");
    expect(
      createExecutionWorkspaceStore(undefined, "http://localhost:9444|workspace-1").getState()
        .submission.phase,
    ).toBe("idle");
    expect(
      createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1").getState()
        .submission.request?.requestId,
    ).toBe(request.requestId);
  });
  it("unlocks configuration after a definitive server rejection while keeping unknown outcomes recoverable", () => {
    const store = createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1");
    store.getState().startRequest(request);
    store.getState().failRequest("Input rejected with 403", true);
    expect(store.getState().submission.phase).toBe("invalid");
    expect(
      createExecutionWorkspaceStore(undefined, "http://localhost:9433|workspace-1").getState()
        .submission.phase,
    ).toBe("idle");
    store.getState().resetRequest();
    expect(store.getState().startRequest(request)).toBe(true);
  });
});
