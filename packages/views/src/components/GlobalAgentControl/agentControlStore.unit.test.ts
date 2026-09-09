import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentControlStore } from "./agentControlStore";
import type { AgentControlClient } from "./agentControlClient";
import {
  savePendingPipelinePrompt,
  hasPendingPipelinePrompt,
} from "../../lib/pendingPipelinePrompt";

describe("homepage Agent handoff", () => {
  beforeEach(() => sessionStorage.clear());

  it("waits for bootstrap, starts a clean conversation and preserves the selected runtime", () => {
    const store = createAgentControlStore({} as AgentControlClient);
    const submit = vi.fn(async () => undefined);
    const openPanel = vi.fn();
    store.setState({
      activeThreadId: "old-thread",
      actions: [{ id: "old-result" }] as never,
      isBootstrapping: true,
      capabilities: { enabled: true } as never,
      canvasSurface: { pipelineId: "new-pipeline", openPanel } as never,
      submit,
    });
    savePendingPipelinePrompt("整理会议待办", {
      runtimeConfigId: "selected",
      model: "chosen-model",
    });
    store.getState().consumePipelinePrompt();
    expect(hasPendingPipelinePrompt()).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    store.setState({ isBootstrapping: false });
    store.getState().consumePipelinePrompt();
    store.getState().consumePipelinePrompt();
    expect(store.getState().activeThreadId).toBeNull();
    expect(store.getState().actions).toEqual([]);
    expect(store.getState().draft).toBe("整理会议待办");
    expect(store.getState().executionChoice).toEqual({
      runtimeConfigId: "selected",
      model: "chosen-model",
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(openPanel).toHaveBeenCalledOnce();
  });

  it("does not discard a pending demand while another run is active", () => {
    const store = createAgentControlStore({} as AgentControlClient);
    store.setState({ isRunning: true, activeThreadId: "running" });
    savePendingPipelinePrompt("new demand");
    store.getState().newThread();
    store.getState().consumePipelinePrompt();
    expect(store.getState().activeThreadId).toBe("running");
    expect(hasPendingPipelinePrompt()).toBe(true);
  });
});
