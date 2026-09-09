import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newPipeline } from "../ExecutionWorkspacePage/_store/store";
import { usePublishedPipelineRun } from "./usePublishedPipelineRun";

const { mutateAsync, getOne } = vi.hoisted(() => ({ mutateAsync: vi.fn(), getOne: vi.fn() }));
vi.mock("@refinedev/core", () => ({
  useDataProvider: () => (name: string) => {
    if (name !== "execution") throw new Error("unexpected provider");
    return { getApiUrl: () => "http://execution.test/api/v2", getOne };
  },
  useCreate: () => ({ mutateAsync }),
}));
const pipeline = {
  ...newPipeline(),
  id: "canonical-pipeline",
  revision: 17,
  graph: {
    ...newPipeline().graph,
    inputs: [
      {
        id: "prompt",
        valueType: "text" as const,
        cardinality: "one" as const,
        required: true,
        allowEmpty: false,
      },
    ],
  },
};
const pendingReceipt = (requestId: string) => ({
  apiVersion: 2,
  requestId,
  state: "awaiting_approval",
  preparedRunId: "prepared-1",
  approvalId: "approval-1",
  expiresAt: "2026-10-01T00:00:00.000Z",
});
const setPrompt = (result: { current: ReturnType<typeof usePublishedPipelineRun> }) =>
  act(() => result.current.setDrafts({ prompt: "real input" }));
beforeEach(() => {
  sessionStorage.clear();
  mutateAsync.mockReset();
  getOne.mockReset();
});
describe("canonical Canvas submission", () => {
  it("submits exact published revision through execution only and prevents duplicate approval requests", async () => {
    mutateAsync.mockImplementation(async ({ values }) => ({
      data: pendingReceipt(values.requestId),
    }));
    const { result } = renderHook(() => usePublishedPipelineRun(pipeline));
    setPrompt(result);
    await act(async () => {
      await Promise.all([result.current.submit(), result.current.submit()]);
    });
    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(mutateAsync).toHaveBeenCalledWith({
      dataProviderName: "execution",
      resource: "run-requests",
      values: expect.objectContaining({
        pipelineId: pipeline.id,
        expectedRevision: 17,
        inputs: { prompt: [{ kind: "text", value: "real input" }] },
      }),
    });
    expect(result.current.state.submission.phase).toBe("awaiting_approval");
    expect(result.current.locked).toBe(true);
    await act(() => result.current.submit());
    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(getOne).not.toHaveBeenCalled();
  });
  it("persists only identity and restores an uncertain original request across remount and newer revisions", async () => {
    mutateAsync.mockRejectedValue(new Error("connection interrupted"));
    const first = renderHook(() => usePublishedPipelineRun(pipeline));
    setPrompt(first.result);
    await act(() => first.result.current.submit());
    const requestId = first.result.current.state.submission.request!.requestId;
    expect(first.result.current.state.submission.phase).toBe("uncertain");
    const raw = sessionStorage.getItem(sessionStorage.key(0)!)!;
    expect(JSON.parse(raw)).toEqual({
      apiVersion: 2,
      requestId,
      pipelineId: pipeline.id,
      expectedRevision: 17,
    });
    expect(raw).not.toContain("real input");
    first.unmount();
    const restored = renderHook(() => usePublishedPipelineRun({ ...pipeline, revision: 18 }));
    expect(restored.result.current.state.submission.request).toMatchObject({
      requestId,
      expectedRevision: 17,
    });
    expect(restored.result.current.locked).toBe(true);
    await act(() => restored.result.current.submit());
    expect(mutateAsync).toHaveBeenCalledOnce();
  });
  it("validates declared inputs before allocating or sending a request", async () => {
    const { result } = renderHook(() => usePublishedPipelineRun(pipeline));
    await act(() => result.current.submit());
    expect(result.current.state.error).toBeTruthy();
    expect(result.current.state.submission.phase).toBe("idle");
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });
  it("treats an explicit 409 as rejected submission and allows a fresh revision after reset", async () => {
    mutateAsync.mockRejectedValueOnce(
      Object.assign(new Error("revision conflict"), { statusCode: 409 }),
    );
    const { result, rerender } = renderHook(
      ({ revision }) => usePublishedPipelineRun({ ...pipeline, revision }),
      { initialProps: { revision: 17 } },
    );
    setPrompt(result);
    await act(() => result.current.submit());
    expect(result.current.state.submission.phase).toBe("invalid");
    expect(result.current.canReset).toBe(true);
    expect(sessionStorage.length).toBe(0);
    const previousId = result.current.state.submission.request!.requestId;
    rerender({ revision: 18 });
    act(() => result.current.reset());
    mutateAsync.mockImplementationOnce(async ({ values }) => ({
      data: pendingReceipt(values.requestId),
    }));
    await act(() => result.current.submit());
    expect(mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ values: expect.objectContaining({ expectedRevision: 18 }) }),
    );
    expect(result.current.state.submission.request!.requestId).not.toBe(previousId);
  });
  it("blocks run while an input import is pending", async () => {
    const { result } = renderHook(() => usePublishedPipelineRun(pipeline));
    setPrompt(result);
    act(() => result.current.setInputBusy(true));
    await act(() => result.current.submit());
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(result.current.locked).toBe(true);
  });
});
