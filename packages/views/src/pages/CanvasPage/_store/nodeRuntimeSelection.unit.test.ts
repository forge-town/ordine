import { describe, expect, it } from "vitest";
import { createCanvasPageStore } from "./canvasPageStore";
import type { PipelineNode } from "./canvasSlice";

const makeStore = () =>
  createCanvasPageStore([
    {
      id: "node",
      type: "operation",
      position: { x: 0, y: 0 },
      data: {
        nodeType: "operation",
        label: "Operation",
        operationId: "op",
        operationName: "Operation",
        status: "idle",
        agentId: "persona-1",
        agentRuntime: "codex",
        executionOverrides: {
          runtimeConfigId: "old-runtime",
          model: "explicit-model",
          reasoningEffort: "high",
          firstOutputTimeoutMs: 0,
        },
      },
    } as PipelineNode,
  ]);

describe("node runtime selection", () => {
  it("retains legacy fields until the user explicitly selects a runtime", () => {
    const store = makeStore();
    expect(store.getState().nodes[0]?.data).toMatchObject({ agentId: "persona-1" });
    store.getState().handleOperationRuntimeChange("node", "saved-runtime");
    expect(store.getState().nodes[0]?.data).toMatchObject({
      agentId: undefined,
      agentRuntime: undefined,
      executionOverrides: {
        runtimeConfigId: "saved-runtime",
        model: "explicit-model",
        reasoningEffort: "high",
        firstOutputTimeoutMs: 0,
      },
    });
  });
  it("inherit removes only runtime selection without discarding other explicit overrides", () => {
    const store = makeStore();
    store.getState().handleOperationRuntimeChange("node", "__default__");
    expect(store.getState().nodes[0]?.data).toMatchObject({
      executionOverrides: {
        model: "explicit-model",
        reasoningEffort: "high",
        firstOutputTimeoutMs: 0,
      },
    });
    expect(store.getState().nodes[0]?.data).not.toHaveProperty(
      "executionOverrides.runtimeConfigId",
    );
  });
  it("ignores invalid and absent selections instead of corrupting node configuration", () => {
    const store = makeStore();
    const before = store.getState().nodes[0]?.data;
    store.getState().handleOperationRuntimeChange("node", null);
    store.getState().handleOperationRuntimeChange("node", "bad runtime id");
    expect(store.getState().nodes[0]?.data).toBe(before);
  });
});
