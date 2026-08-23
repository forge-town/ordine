import { describe, expect, it } from "vitest";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { projectRuntimeCatalogFromConfigs } from "./projectRuntimeCatalogFromConfigs";

describe("projectRuntimeCatalogFromConfigs", () => {
  it("projects the last persisted local detection without probing the CLI", () => {
    const runtimes: AgentRuntimeConfig[] = [
      {
        id: "saved-codex",
        name: "Codex CLI",
        type: "codex",
        connection: {
          mode: "local",
          binaryName: "codex.exe",
          path: "C:/tools/codex.exe",
          version: "0.149.0",
          models: [{ id: "gpt-5.6-sol", displayName: "GPT-5.6 Sol" }],
          modelsSource: "live",
        },
      },
    ];

    const catalog = projectRuntimeCatalogFromConfigs(runtimes);
    const codex = catalog.find((entry) => entry.runtime === "codex");

    expect(codex).toMatchObject({
      runtimeConfigId: "saved-codex",
      availability: "launchable",
      path: "C:/tools/codex.exe",
      version: "0.149.0",
      authenticationStatus: "unknown",
      modelsSource: "live",
      models: [{ id: "gpt-5.6-sol" }],
    });
    expect(codex?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "RUNTIME_CATALOG_CACHED" })]),
    );
    expect(catalog.find((entry) => entry.runtime === "opencode")).toMatchObject({
      runtimeConfigId: null,
      availability: "unavailable",
    });
  });

  it("does not expose an SSH runtime as a cached local detection", () => {
    const catalog = projectRuntimeCatalogFromConfigs([
      {
        id: "remote-codex",
        name: "Remote Codex",
        type: "codex",
        connection: {
          mode: "ssh",
          host: "example.test",
          user: "ordine",
          port: 22,
        },
      },
    ]);

    expect(catalog.find((entry) => entry.runtime === "codex")).toMatchObject({
      runtimeConfigId: null,
      availability: "unavailable",
    });
  });
});
