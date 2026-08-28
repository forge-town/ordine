import { describe, expect, it } from "vitest";
import type { AgentRuntimeCatalogEntry, Settings } from "@repo/schemas";
import {
  changeExecutionModel,
  changeExecutionRuntime,
  resolveAgentExecutionChoice,
} from "./agentExecutionChoice";

const catalogEntry = (
  input: Partial<AgentRuntimeCatalogEntry> &
    Pick<AgentRuntimeCatalogEntry, "runtime" | "runtimeConfigId">,
): AgentRuntimeCatalogEntry => {
  const { runtime, runtimeConfigId, ...overrides } = input;

  return {
    runtime,
    displayName: runtime,
    runtimeConfigId,
    availability: "launchable",
    binaryName: runtime,
    path: `C:\\bin\\${runtime}.exe`,
    version: "1.0.0",
    authenticationStatus: "authenticated",
    authenticationMessage: null,
    diagnostics: [],
    models: [],
    modelsSource: "live",
    supportsCustomModel: true,
    compatibility: {
      runtime,
      displayName: runtime,
      supportLevel: "supported",
      binaries: [runtime],
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
    ...overrides,
  };
};

const settings: Settings = {
  id: "default",
  defaultAgentRuntime: "codex",
  defaultAgentRuntimeConfigId: "local-codex",
  agentRuntimePreferences: {
    "local-codex": { model: "gpt-5.6", reasoningEffort: "high", speed: "priority" },
    "local-opencode": { model: "anthropic/claude-sonnet-4-5" },
  },
  defaultApiKey: "",
  defaultModel: "",
  defaultOutputPath: "",
};

describe("agent execution choice", () => {
  const catalog = [
    catalogEntry({
      runtime: "codex",
      runtimeConfigId: "local-codex",
      models: [
        {
          id: "gpt-5.6",
          displayName: "GPT-5.6",
          isDefault: true,
          defaultReasoningEffort: "medium",
          reasoningEfforts: [{ value: "medium" }, { value: "high" }],
          defaultSpeed: "standard",
          speeds: [{ value: "standard" }, { value: "priority" }],
        },
      ],
    }),
    catalogEntry({
      runtime: "opencode",
      runtimeConfigId: "local-opencode",
      models: [{ id: "anthropic/claude-sonnet-4-5", displayName: "Claude Sonnet 4.5" }],
    }),
  ];

  it("restores the runtime-scoped model, reasoning, and speed", () => {
    expect(resolveAgentExecutionChoice(catalog, settings)).toEqual({
      runtimeConfigId: "local-codex",
      model: "gpt-5.6",
      reasoningEffort: "high",
      speed: "priority",
      firstOutputTimeoutSeconds: 45,
    });
    expect(changeExecutionRuntime(catalog, settings, "local-opencode")).toEqual({
      runtimeConfigId: "local-opencode",
      model: "anthropic/claude-sonnet-4-5",
      firstOutputTimeoutSeconds: 45,
    });
  });

  it("does not leak an incompatible legacy default model into the selected runtime", () => {
    expect(
      resolveAgentExecutionChoice(catalog, {
        ...settings,
        agentRuntimePreferences: {},
        defaultModel: "kimi-for-coding/k2p6",
      }),
    ).toEqual({
      runtimeConfigId: "local-codex",
      model: "gpt-5.6",
      reasoningEffort: "medium",
      speed: "standard",
      firstOutputTimeoutSeconds: 45,
    });
  });

  it("clears stale reasoning and speed when a model changes", () => {
    expect(
      changeExecutionModel(
        catalog[1]!,
        {
          runtimeConfigId: "local-opencode",
          model: "old",
          reasoningEffort: "high",
          speed: "priority",
          firstOutputTimeoutSeconds: 180,
        },
        "anthropic/claude-sonnet-4-5",
      ),
    ).toEqual({
      runtimeConfigId: "local-opencode",
      model: "anthropic/claude-sonnet-4-5",
      firstOutputTimeoutSeconds: 180,
    });
  });

  it("never selects experimental runtimes for formal execution", () => {
    const experimental = catalogEntry({
      runtime: "pi-agent",
      runtimeConfigId: "local-pi-agent",
      compatibility: {
        ...catalog[0]!.compatibility,
        runtime: "pi-agent",
        supportLevel: "experimental",
      },
    });

    expect(resolveAgentExecutionChoice([experimental], settings)).toBeNull();
  });
});
