import { describe, expect, it } from "vitest";
import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import { getAgentRuntimeCatalogData } from "./agentRuntimeCatalogData";

const entry: AgentRuntimeCatalogEntry = {
  runtime: "codex",
  displayName: "Codex CLI",
  binaryName: "codex",
  availability: "launchable",
  path: "C:\\tools\\codex.exe",
  version: "codex 1.0.0",
  runtimeConfigId: "runtime-codex",
  authenticationStatus: "unknown",
  authenticationMessage: null,
  modelsSource: "fallback",
  models: [],
  supportsCustomModel: true,
  diagnostics: [],
  compatibility: {
    runtime: "codex",
    displayName: "Codex CLI",
    supportLevel: "supported",
    binaries: ["codex"],
    versionArgs: ["--version"],
    streamFormat: "codex-jsonl",
    capabilities: {
      cancellation: "signal",
      mcpInjection: "config",
      resume: "cli",
      textStreaming: "message",
      thinking: true,
      toolEvents: true,
      usage: true,
      imageInput: false,
    },
  },
};

describe("getAgentRuntimeCatalogData", () => {
  it("accepts the direct catalog shape", () => {
    expect(getAgentRuntimeCatalogData([entry])).toEqual([entry]);
  });

  it("unwraps the Refine custom result data shape", () => {
    expect(getAgentRuntimeCatalogData({ data: [entry] })).toEqual([entry]);
  });

  it("rejects malformed catalog payloads", () => {
    expect(getAgentRuntimeCatalogData({ data: { runtime: "codex" } })).toEqual([]);
  });
});
