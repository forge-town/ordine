import { describe, expect, it } from "vitest";
import { AgentRuntimeCatalogEntrySchema } from "./AgentRuntimeCatalogSchema";

describe("AgentRuntimeCatalogEntrySchema", () => {
  it("distinguishes launch evidence, model provenance, and authentication", () => {
    const entry = {
      runtime: "opencode",
      displayName: "OpenCode",
      runtimeConfigId: "local-opencode",
      availability: "launchable",
      binaryName: "opencode",
      path: "C:\\tools\\opencode.exe",
      version: "1.18.21",
      authenticationStatus: "unknown",
      authenticationMessage: null,
      diagnostics: [],
      models: [{ id: "openai/gpt-5", displayName: "openai/gpt-5" }],
      modelsSource: "live",
      supportsCustomModel: true,
      compatibility: {
        runtime: "opencode",
        displayName: "OpenCode",
        supportLevel: "supported",
        binaries: ["opencode"],
        versionArgs: ["--version"],
        streamFormat: "json-event-stream",
        capabilities: {
          textStreaming: "message",
          thinking: false,
          toolEvents: true,
          usage: true,
          cancellation: "signal",
          resume: "session",
          mcpInjection: "config",
          imageInput: true,
        },
      },
    } as const;

    expect(AgentRuntimeCatalogEntrySchema.parse(entry)).toEqual(entry);
  });
});
