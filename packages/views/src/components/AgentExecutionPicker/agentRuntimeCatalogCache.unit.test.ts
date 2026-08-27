import { describe, expect, it } from "vitest";
import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import {
  readAgentRuntimeCatalogCache,
  writeAgentRuntimeCatalogCache,
} from "./agentRuntimeCatalogCache";

const catalogEntry: AgentRuntimeCatalogEntry = {
  runtime: "codex",
  displayName: "Codex CLI",
  runtimeConfigId: "local-codex",
  availability: "launchable",
  binaryName: "codex.exe",
  path: "C:/tools/codex.exe",
  version: "0.149.0",
  authenticationStatus: "authenticated",
  authenticationMessage: null,
  diagnostics: [],
  models: [{ id: "gpt-5.6-sol", displayName: "GPT-5.6 Sol" }],
  modelsSource: "live",
  supportsCustomModel: true,
  compatibility: {
    runtime: "codex",
    displayName: "Codex CLI",
    supportLevel: "supported",
    binaries: ["codex"],
    versionArgs: ["--version"],
    streamFormat: "json-event-stream",
    capabilities: {
      textStreaming: "message",
      thinking: true,
      toolEvents: true,
      usage: true,
      cancellation: "signal",
      resume: "session",
      pause: "none",
      mcpInjection: "config",
      imageInput: false,
    },
  },
};

const createStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("agent runtime catalog browser cache", () => {
  it("restores the last valid catalog during a page refresh", () => {
    const storage = createStorage();
    writeAgentRuntimeCatalogCache([catalogEntry], storage, 1_000);

    expect(readAgentRuntimeCatalogCache(storage, 2_000)).toEqual([catalogEntry]);
  });

  it("rejects expired and malformed cache entries", () => {
    const storage = createStorage();
    writeAgentRuntimeCatalogCache([catalogEntry], storage, 1_000);

    expect(readAgentRuntimeCatalogCache(storage, 24 * 60 * 60 * 1_000 + 1_001)).toEqual([]);
    storage.setItem("ordine.agent-runtime-catalog.v1", "not-json");
    expect(readAgentRuntimeCatalogCache(storage, 2_000)).toEqual([]);
  });
});
