import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunRequestInput } from "@repo/schemas";
import { usePublishedRun } from "./usePublishedRun";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@refinedev/core", () => ({ useCreate: () => ({ mutateAsync: create }) }));
const prepared = {
  pipelineId: "actual-saved-pipeline",
  expectedRevision: 7,
  inputs: { source: [{ kind: "text" as const, value: "secret-content" }] },
  executionOverrides: {},
  deliveryRequirements: [],
};
beforeEach(() => {
  sessionStorage.clear();
  create.mockReset();
});
describe("published run submission", () => {
  it("submits the exact published revision once using the execution provider", async () => {
    create.mockImplementation(async ({ values }: { values: RunRequestInput }) => ({
      data: {
        apiVersion: 2,
        requestId: values.requestId,
        state: "accepted",
        preparedRunId: "prepared",
        jobId: "job",
        acceptedAt: "2026-09-08T12:00:00Z",
      },
    }));
    const prepare = vi.fn(async () => prepared);
    const { result } = renderHook(() => usePublishedRun("test"));
    await act(async () => {
      await Promise.all([result.current.submit(prepare), result.current.submit(prepare)]);
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      dataProviderName: "execution",
      resource: "run-requests",
      values: expect.objectContaining(prepared),
    });
    expect(result.current.state.submission.phase).toBe("accepted");
  });
  it("preserves unknown identity across reload and blocks replacement IDs", async () => {
    create.mockRejectedValue(new Error("network timeout"));
    const prepare = vi.fn(async () => prepared);
    const first = renderHook(() => usePublishedRun("recovery"));
    await act(async () => {
      await first.result.current.submit(prepare);
    });
    const requestId = first.result.current.state.submission.request?.requestId;
    expect(first.result.current.state.submission.phase).toBe("uncertain");
    expect(sessionStorage.getItem("ordine.execution.v2.request:recovery")).not.toContain(
      "secret-content",
    );
    first.unmount();
    const restored = renderHook(() => usePublishedRun("recovery"));
    expect(restored.result.current.state.submission.request?.requestId).toBe(requestId);
    await act(async () => {
      restored.result.current.handleReset();
      await restored.result.current.submit(prepare);
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("lets a definitive 4xx rejection be corrected and retried explicitly", async () => {
    create.mockRejectedValue(Object.assign(new Error("invalid inputs"), { statusCode: 422 }));
    const { result } = renderHook(() => usePublishedRun("rejected"));
    await act(async () => {
      await result.current.submit(async () => prepared);
    });
    const original = result.current.state.submission.request?.requestId;
    expect(result.current.state.submission.phase).toBe("invalid");
    expect(sessionStorage.getItem("ordine.execution.v2.request:rejected")).toBeNull();
    await act(async () => {
      result.current.handleReset();
      await result.current.submit(async () => prepared);
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.current.state.submission.request?.requestId).not.toBe(original);
  });
  it("keeps a failed publish or input validation retryable without a request", async () => {
    const { result } = renderHook(() => usePublishedRun("publish-error"));
    await act(async () => {
      await result.current.submit(async () => {
        throw new Error("JSON 格式无效");
      });
    });
    expect(result.current.state.submission.phase).toBe("idle");
    expect(result.current.state.error).toBe("JSON 格式无效");
    expect(create).not.toHaveBeenCalled();
  });
  it("clears an unknown-result error when the original receipt arrives", async () => {
    create.mockRejectedValue(new Error("network timeout"));
    const { result } = renderHook(() => usePublishedRun("receipt-recovery"));
    await act(async () => {
      await result.current.submit(async () => prepared);
    });
    const requestId = result.current.state.submission.request!.requestId;
    act(() =>
      result.current.handleReceipt({
        apiVersion: 2,
        requestId,
        state: "accepted",
        preparedRunId: "prepared",
        jobId: "job",
        acceptedAt: "2026-09-08T12:00:00Z",
      }),
    );
    expect(result.current.state.submission.phase).toBe("accepted");
    expect(result.current.state.error).toBeNull();
  });
});
