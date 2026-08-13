import { describe, expect, it } from "vitest";
import {
  deriveCapabilityAssignmentAgentTargets,
  resolveAssignmentOrchestrator,
  type AssignmentRuntimeRecord,
} from "./resolveAssignmentRuntime";

const runtimes = [
  {
    id: "codex-primary",
    type: "codex",
    connection: {
      mode: "local",
      models: [
        { id: "gpt-fast", displayName: "Fast" },
        { id: "gpt-default", displayName: "Default", isDefault: true },
      ],
    },
  },
  {
    id: "codex-secondary",
    type: "codex",
    connection: {
      mode: "local",
      models: [
        { id: "gpt-fast", displayName: "Fast duplicate" },
        { id: "gpt-deep", displayName: "Deep" },
      ],
    },
  },
  {
    id: "claude-empty",
    type: "claude-code",
    connection: { mode: "local" },
  },
] satisfies AssignmentRuntimeRecord[];

describe("assignment runtime resolution", () => {
  it("deduplicates configured runtime ids into persisted agent/model targets", () => {
    expect(deriveCapabilityAssignmentAgentTargets(runtimes)).toEqual([
      { agent: "codex", models: ["gpt-deep", "gpt-default", "gpt-fast"] },
    ]);
  });

  it("uses the selected runtime and requested model when both are catalog-valid", () => {
    const result = resolveAssignmentOrchestrator({
      runtimes,
      requestedRuntimeId: "codex-secondary",
      requestedModel: "gpt-deep",
      defaultRuntime: "codex",
      defaultModel: "gpt-fast",
    });

    expect(result).toMatchObject({
      runtime: { id: "codex-secondary" },
      model: "gpt-deep",
      source: "session",
    });
  });

  it("falls back to a valid default target when the session selection is invalid", () => {
    const result = resolveAssignmentOrchestrator({
      runtimes,
      requestedRuntimeId: "missing-runtime",
      requestedModel: "invented-model",
      defaultRuntime: "codex",
      defaultModel: "gpt-fast",
    });

    expect(result).toMatchObject({
      runtime: { id: "codex-primary" },
      model: "gpt-fast",
      source: "default",
    });
  });

  it("uses the runtime catalog default when the configured default model is unavailable", () => {
    const result = resolveAssignmentOrchestrator({
      runtimes,
      defaultRuntime: "codex",
      defaultModel: "invented-model",
    });

    expect(result).toMatchObject({
      runtime: { id: "codex-primary" },
      model: "gpt-default",
      source: "default",
    });
  });

  it("returns null when no runtime has a COD-337 model catalog", () => {
    expect(
      resolveAssignmentOrchestrator({
        runtimes: [runtimes[2]!],
        defaultRuntime: "claude-code",
      }),
    ).toBeNull();
  });
});
