import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { SELF_HEAL_RETRIES_DEFAULT } from "@/store/autonomyStore/autonomyStore";
import { toastStore } from "@/store/toastStore";
import { useJobControls } from "./useJobControls";

vi.mock("@/integrations/refine/dataProvider", () => ({
  dataProvider: { custom: vi.fn() },
}));

const customMock = vi.mocked(dataProvider.custom!);

describe("useJobControls", () => {
  beforeEach(() => {
    customMock.mockReset();
    toastStore.setState({ toasts: [] });
  });

  it("posts job actions to jobs/<action> and reports success data", async () => {
    customMock.mockResolvedValue({ data: { ok: true } });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useJobControls());

    act(() => {
      result.current.control({ action: "cancel", jobId: "job_1" }, { errorTitle: "x", onSuccess });
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ ok: true }));
    expect(customMock).toHaveBeenCalledWith({
      method: "post",
      payload: { jobId: "job_1" },
      url: "jobs/cancel",
    });
    expect(result.current.pendingKey).toBeNull();
  });

  it("posts run requests to pipelines/run keyed by pipelineId", async () => {
    customMock.mockResolvedValue({ data: { jobId: "job_2" } });
    const { result } = renderHook(() => useJobControls());

    act(() => {
      result.current.control({ action: "run", pipelineId: "p_1" }, { errorTitle: "x" });
    });

    expect(result.current.pendingKey).toBe("p_1");
    await waitFor(() => expect(result.current.pendingKey).toBeNull());
    expect(customMock).toHaveBeenCalledWith({
      method: "post",
      payload: { id: "p_1", selfHealRetries: SELF_HEAL_RETRIES_DEFAULT },
      url: "pipelines/run",
    });
  });

  it("shows the caller-provided error toast on failure and clears pending", async () => {
    customMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useJobControls());

    act(() => {
      result.current.control(
        { action: "pause", jobId: "job_3" },
        { errorTitle: "暂停失败", pendingKey: "row-3" },
      );
    });

    expect(result.current.pendingKey).toBe("row-3");
    await waitFor(() => expect(result.current.pendingKey).toBeNull());
    expect(toastStore.getState().toasts.at(-1)?.title).toBe("暂停失败");
  });
});
