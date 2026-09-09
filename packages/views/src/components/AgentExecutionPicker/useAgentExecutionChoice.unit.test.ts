import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRuntimeCatalogEntry, Settings } from "@repo/schemas";
import { useAgentExecutionChoice } from "./useAgentExecutionChoice";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  catalog: [] as AgentRuntimeCatalogEntry[],
  settings: {} as Settings,
}));
vi.mock("@refinedev/core", () => ({
  useCustom: () => ({ result: { data: mocks.catalog }, query: { isLoading: false } }),
  useOne: () => ({ result: mocks.settings, query: { isLoading: false } }),
  useUpdate: () => ({ mutate: mocks.update, mutation: { isPending: false } }),
}));
const entry = (id: string): AgentRuntimeCatalogEntry => ({
  runtime: "codex",
  displayName: "Codex",
  runtimeConfigId: id,
  availability: "launchable",
  binaryName: "codex",
  path: "/codex",
  version: "1",
  authenticationStatus: "authenticated",
  authenticationMessage: null,
  diagnostics: [],
  models: [{ id: "model", displayName: "Model" }],
  modelsSource: "live",
  supportsCustomModel: true,
  compatibility: {
    runtime: "codex",
    displayName: "Codex",
    supportLevel: "supported",
    binaries: ["codex"],
    versionArgs: ["--version"],
    streamFormat: "jsonl",
    capabilities: {
      textStreaming: "delta",
      thinking: true,
      toolEvents: true,
      usage: true,
      cancellation: "signal",
      resume: "cli",
      pause: "none",
      mcpInjection: "config",
      imageInput: false,
    },
  },
});
beforeEach(() => {
  mocks.update.mockClear();
  mocks.catalog = [entry("runtime-1"), entry("runtime-2")];
  mocks.settings = {
    id: "default",
    defaultAgentRuntime: "codex",
    defaultAgentRuntimeConfigId: "runtime-1",
    defaultApiKey: "",
    defaultModel: "model",
    defaultOutputPath: "",
    agentRuntimePreferences: {
      "runtime-1": {
        model: "model",
        reasoningEffort: "high",
        speed: "priority",
        firstOutputTimeoutSeconds: 180,
      },
    },
  };
});
describe("run-scoped execution selection", () => {
  it("displays defaults without treating them as explicit run overrides", () => {
    const { result } = renderHook(() => useAgentExecutionChoice({ scope: "run" }));
    expect(result.current.choice).toMatchObject({
      runtimeConfigId: "runtime-1",
      model: "model",
      firstOutputTimeoutSeconds: 180,
    });
    expect(result.current.explicitOverrides).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("only overrides the changed timeout, retaining zero and leaving Settings untouched", () => {
    const { result } = renderHook(() => useAgentExecutionChoice({ scope: "run" }));
    act(() =>
      result.current.persistChoice({ ...result.current.choice!, firstOutputTimeoutSeconds: 0 }, [
        "firstOutputTimeoutSeconds",
      ]),
    );
    expect(result.current.explicitOverrides).toStrictEqual({ firstOutputTimeoutSeconds: 0 });
    expect(result.current.choice?.model).toBe("model");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps prior explicit fields when runtime/model changes instead of silently resetting them", () => {
    const { result } = renderHook(() => useAgentExecutionChoice({ scope: "run" }));
    act(() =>
      result.current.persistChoice(
        { ...result.current.choice!, reasoningEffort: "xhigh", firstOutputTimeoutSeconds: 0 },
        ["reasoningEffort", "firstOutputTimeoutSeconds"],
      ),
    );
    act(() => result.current.selectRuntime("runtime-2"));
    act(() =>
      result.current.persistChoice(
        { ...result.current.choice!, model: "custom", reasoningEffort: "low" },
        ["model"],
      ),
    );
    expect(result.current.explicitOverrides).toStrictEqual({
      runtimeConfigId: "runtime-2",
      model: "custom",
      reasoningEffort: "xhigh",
      firstOutputTimeoutSeconds: 0,
    });
    expect(result.current.choice?.reasoningEffort).toBe("xhigh");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not apply one pipeline's selections to another pipeline", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useAgentExecutionChoice({ scope: "run", runScopeId: id }),
      { initialProps: { id: "first" } },
    );
    act(() =>
      result.current.persistChoice({ ...result.current.choice!, firstOutputTimeoutSeconds: 0 }, [
        "firstOutputTimeoutSeconds",
      ]),
    );
    rerender({ id: "second" });
    expect(result.current.explicitOverrides).toBeNull();
    expect(result.current.choice?.firstOutputTimeoutSeconds).toBe(180);
  });
  it("preserves the Agent session's existing global preference behavior", () => {
    const { result } = renderHook(() => useAgentExecutionChoice());
    act(() =>
      result.current.persistChoice({ ...result.current.choice!, firstOutputTimeoutSeconds: 0 }, [
        "firstOutputTimeoutSeconds",
      ]),
    );
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(
      mocks.update.mock.calls[0]?.[0].values.agentRuntimePreferences["runtime-1"]
        .firstOutputTimeoutSeconds,
    ).toBe(0);
  });
});
