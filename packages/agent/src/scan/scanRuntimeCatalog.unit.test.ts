import { beforeEach, describe, expect, it, vi } from "vitest";

const scanRuntimesMock = vi.fn();
const spawnCommandMock = vi.fn();

vi.mock("./scanRuntimes", () => ({
  getRuntimeBinaries: () => ({
    codex: "codex",
    "claude-code": "claude",
    opencode: "opencode",
  }),
  scanRuntimes: (...args: unknown[]) => scanRuntimesMock(...args),
}));

vi.mock("../spawn/spawnCommand", () => ({
  spawnCommand: (...args: unknown[]) => spawnCommandMock(...args),
}));

import { scanRuntimeCatalog } from "./scanRuntimeCatalog";

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
});
