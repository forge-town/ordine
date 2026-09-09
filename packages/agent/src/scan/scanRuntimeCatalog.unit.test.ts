import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const scanRuntimesMock = vi.fn();
const spawnCommandMock = vi.fn();
const probeRuntimePathMock = vi.fn();

vi.mock("./scanRuntimes", () => ({
  getRuntimeBinaries: () => ({
    codex: "codex",
    "claude-code": "claude",
    opencode: "opencode",
  }),
  scanRuntimes: (...args: unknown[]) => scanRuntimesMock(...args),
  probeRuntimePath: (...args: unknown[]) => probeRuntimePathMock(...args),
}));

vi.mock("../spawn/spawnCommand", () => ({
  spawnCommand: (...args: unknown[]) => spawnCommandMock(...args),
}));

import { resolveRuntimeCatalogFromConfigs, scanRuntimeCatalog } from "./scanRuntimeCatalog";
import { projectRuntimeCatalogFromConfigs } from "./projectRuntimeCatalogFromConfigs";
import type { AgentRuntimeConfig } from "@repo/schemas";

describe("scanRuntimeCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps all manifests while distinguishing live and fallback model evidence", async () => {
    scanRuntimesMock.mockResolvedValue([
      {
        type: "opencode",
        binaryName: "opencode",
        path: "C:/tools/opencode.exe",
        version: "1.18.21",
        models: [{ id: "openai/gpt-5", displayName: "openai/gpt-5" }],
        modelsSource: "live",
      },
    ]);

    const catalog = await scanRuntimeCatalog();

    expect(catalog.find((entry) => entry.runtime === "opencode")).toMatchObject({
      availability: "launchable",
      runtimeConfigId: "local-opencode",
      modelsSource: "live",
      models: [{ id: "openai/gpt-5" }],
    });
    expect(catalog.find((entry) => entry.runtime === "codex")).toMatchObject({
      availability: "unavailable",
      runtimeConfigId: null,
      modelsSource: "fallback",
    });
    expect(spawnCommandMock).not.toHaveBeenCalled();
  });

  it("validates each saved path independently even when PATH finds no runtime and preserves saved models", async () => {
    const configs: AgentRuntimeConfig[] = [
      {
        id: "native-a",
        name: "Primary",
        type: "opencode",
        connection: {
          mode: "local",
          path: "C:/native/a.exe",
          models: [
            {
              id: "custom-model",
              displayName: "Custom",
              reasoningEfforts: [{ value: "high", label: "High" }],
            },
          ],
          modelsSource: "live",
        },
      },
      {
        id: "native-b",
        name: "Secondary",
        type: "opencode",
        connection: {
          mode: "local",
          path: "C:/native/b.exe",
          models: [{ id: "second-model", displayName: "Second" }],
        },
      },
    ];
    probeRuntimePathMock.mockImplementation(async (path) => ({ path, version: "1.0" }));
    const result = await resolveRuntimeCatalogFromConfigs(
      projectRuntimeCatalogFromConfigs([]),
      configs,
    );
    expect(result.filter((entry) => entry.runtime === "opencode")).toEqual([
      expect.objectContaining({
        runtimeConfigId: "native-a",
        path: "C:/native/a.exe",
        availability: "launchable",
        models: configs[0]!.connection.mode === "local" ? configs[0]!.connection.models : [],
        modelsSource: "live",
      }),
      expect.objectContaining({
        runtimeConfigId: "native-b",
        path: "C:/native/b.exe",
        availability: "launchable",
        models: [{ id: "second-model", displayName: "Second" }],
      }),
    ]);
    expect(probeRuntimePathMock.mock.calls).toEqual([["C:/native/a.exe"], ["C:/native/b.exe"]]);
    expect(spawnCommandMock).not.toHaveBeenCalled();
  });

  it("keeps a missing saved executable unavailable instead of relabeling a different discovered binary", async () => {
    const configs: AgentRuntimeConfig[] = [
      {
        id: "saved",
        name: "Saved Codex",
        type: "codex",
        connection: {
          mode: "local",
          path: "C:/missing/codex.exe",
          models: [{ id: "saved-model", displayName: "Saved" }],
        },
      },
    ];
    probeRuntimePathMock.mockResolvedValue(undefined);
    const discovery = projectRuntimeCatalogFromConfigs([
      {
        id: "local-codex",
        name: "Other",
        type: "codex",
        connection: { mode: "local", path: "C:/other/codex.exe", version: "2.0" },
      },
    ]);
    const result = await resolveRuntimeCatalogFromConfigs(discovery, configs);
    expect(result.find((entry) => entry.runtimeConfigId === "saved")).toMatchObject({
      availability: "unavailable",
      path: "C:/missing/codex.exe",
      version: null,
      models: [{ id: "saved-model", displayName: "Saved" }],
      diagnostics: [expect.objectContaining({ code: "RUNTIME_CONFIGURED_PATH_UNAVAILABLE" })],
    });
    expect(probeRuntimePathMock).toHaveBeenCalledExactlyOnceWith("C:/missing/codex.exe");
    expect(spawnCommandMock).not.toHaveBeenCalled();
  });

  it("runs the Codex authentication probe against its saved binary, never the PATH discovery", async () => {
    probeRuntimePathMock.mockResolvedValue({ path: "C:/native/Codex.exe", version: "codex 1.0" });
    spawnCommandMock.mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: vi.fn(),
      });
      queueMicrotask(() => child.emit("close", 0));

      return child;
    });
    const result = await resolveRuntimeCatalogFromConfigs(projectRuntimeCatalogFromConfigs([]), [
      {
        id: "native-codex",
        name: "Native Codex",
        type: "codex",
        connection: {
          mode: "local",
          path: "C:/native/Codex.exe",
          models: [
            {
              id: "gpt-5.5",
              displayName: "Saved GPT",
              speeds: [{ value: "standard", label: "Standard" }],
            },
          ],
        },
      },
    ]);
    expect(result.find((entry) => entry.runtimeConfigId === "native-codex")).toMatchObject({
      availability: "launchable",
      path: "C:/native/Codex.exe",
      authenticationStatus: "authenticated",
      models: [
        {
          id: "gpt-5.5",
          displayName: "Saved GPT",
          speeds: [{ value: "standard", label: "Standard" }],
        },
      ],
    });
    expect(spawnCommandMock).toHaveBeenCalledExactlyOnceWith(
      "C:/native/Codex.exe",
      ["login", "status"],
      expect.any(Object),
    );
  });
});
