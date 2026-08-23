import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
  process.env.ORDINE_LOCAL_MODE = "true";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ordine";
  process.env.RUNTIME_SCAN_MODE = "local";
});

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  harvest: vi.fn(),
  harvestOnce: vi.fn(),
  scanRuntimeCatalog: vi.fn(),
  scanRuntimes: vi.fn(),
  syncAll: vi.fn(),
}));

vi.mock("../services", () => ({
  agentRuntimesService: {
    getAll: mocks.getAll,
    syncAll: mocks.syncAll,
  },
  capabilityHarvestService: {
    harvest: mocks.harvest,
    harvestOnce: mocks.harvestOnce,
  },
}));
vi.mock("@repo/agent", () => ({
  createRuntimeCatalogCache: ({ load }: { load: () => Promise<unknown[]> }) => ({
    get: (seed?: unknown[]) =>
      Promise.resolve(seed ?? []).then((catalog) => {
        void load();

        return catalog;
      }),
    refresh: load,
    warm: vi.fn(),
  }),
  projectRuntimeCatalogFromConfigs: (runtimes: Array<Record<string, unknown>>) =>
    runtimes.map((runtime) => ({
      runtime: runtime.type,
      runtimeConfigId: runtime.id,
      availability: "launchable",
    })),
  scanRuntimeCatalog: mocks.scanRuntimeCatalog,
  scanRuntimes: mocks.scanRuntimes,
}));

import { agentRuntimesRouter } from "./agentRuntimes";

describe("agentRuntimesRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const harvestResult = ok({
      connectorsCreated: 0,
      connectorsUpdated: 0,
      skillsCreated: 0,
      skillsUpdated: 0,
      mcpFiles: [],
      skillRoots: [],
      diagnostics: { mcp: [], skills: [] },
    });
    mocks.harvest.mockResolvedValue(harvestResult);
    mocks.harvestOnce.mockResolvedValue(harvestResult);
    mocks.scanRuntimeCatalog.mockResolvedValue([]);
  });

  it("auto-discovers and persists local Agents when the local database is empty", async () => {
    mocks.getAll.mockResolvedValue([]);
    mocks.scanRuntimes.mockResolvedValue([
      {
        type: "hermes",
        binaryName: "hermes",
        path: "C:/tools/hermes.exe",
        version: "Hermes 1.0.0",
      },
    ]);
    mocks.syncAll.mockImplementation(async (runtimes) => runtimes);

    const result = await agentRuntimesRouter.createCaller({ session: null }).getMany();

    expect(mocks.syncAll).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "local-hermes",
        name: "hermes",
        type: "hermes",
        connection: expect.objectContaining({
          binaryName: "hermes",
          mode: "local",
          path: "C:/tools/hermes.exe",
        }),
      }),
    ]);
    expect(result).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "local-hermes" })]),
    );
    expect(mocks.harvestOnce).toHaveBeenCalledWith({});
  });

  it("loads capabilities without rescanning binaries once runtimes exist", async () => {
    const existing = [{ id: "local-codex" }];
    mocks.getAll.mockResolvedValue(existing);

    await expect(agentRuntimesRouter.createCaller({ session: null }).getMany()).resolves.toBe(
      existing,
    );
    expect(mocks.scanRuntimes).not.toHaveBeenCalled();
    expect(mocks.syncAll).not.toHaveBeenCalled();
    expect(mocks.harvestOnce).toHaveBeenCalledWith({});
  });

  it("serves the persisted runtime catalog seed without waiting for a binary rescan", async () => {
    const existing = [
      {
        id: "saved-opencode",
        name: "OpenCode",
        type: "opencode",
        connection: { mode: "local" },
      },
    ];
    mocks.getAll.mockResolvedValue(existing);
    const result = await agentRuntimesRouter.createCaller({ session: null }).getCatalog();

    expect(result).toEqual([
      expect.objectContaining({ runtime: "opencode", runtimeConfigId: "saved-opencode" }),
    ]);
    expect(mocks.scanRuntimeCatalog).toHaveBeenCalledOnce();
    expect(mocks.syncAll).not.toHaveBeenCalled();
  });

  it("rescans by upserting positive detections and preserves unavailable catalog entries", async () => {
    mocks.scanRuntimeCatalog.mockResolvedValue([
      {
        runtime: "codex",
        displayName: "Codex CLI",
        runtimeConfigId: "local-codex",
        availability: "launchable",
        binaryName: "codex",
        path: "C:/tools/codex.exe",
        version: "0.149.0",
        authenticationStatus: "authenticated",
        authenticationMessage: null,
        diagnostics: [],
        models: [],
        modelsSource: "none",
        supportsCustomModel: true,
        compatibility: { runtime: "codex" },
      },
      {
        runtime: "opencode",
        displayName: "OpenCode",
        runtimeConfigId: null,
        availability: "unavailable",
        binaryName: "opencode",
        path: null,
        version: null,
        authenticationStatus: "unknown",
        authenticationMessage: null,
        diagnostics: [],
        models: [],
        modelsSource: "none",
        supportsCustomModel: true,
        compatibility: { runtime: "opencode" },
      },
    ]);
    mocks.syncAll.mockImplementation(async (runtimes) => runtimes);

    const result = await agentRuntimesRouter.createCaller({ session: null }).rescanCatalog();

    expect(mocks.syncAll).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "local-codex",
        connection: expect.objectContaining({ path: "C:/tools/codex.exe" }),
      }),
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runtime: "opencode", availability: "unavailable" }),
      ]),
    );
  });

  it("harvests local runtime capabilities for an authenticated workspace request", async () => {
    mocks.harvest.mockResolvedValue(
      ok({
        connectorsCreated: 1,
        connectorsUpdated: 0,
        skillsCreated: 2,
        skillsUpdated: 0,
        mcpFiles: [],
        skillRoots: [],
        diagnostics: { mcp: [], skills: [] },
      }),
    );
    const caller = agentRuntimesRouter.createCaller({
      session: { user: { id: "user-1" } },
    });

    const result = await caller.harvestCapabilities({
      workspacePath: "D:/Coding/project",
    });

    expect(mocks.harvest).toHaveBeenCalledWith({
      workspacePath: "D:/Coding/project",
    });
    expect(result).toMatchObject({ connectorsCreated: 1, skillsCreated: 2 });
  });

  it("does not expose capability harvesting without a session", async () => {
    const caller = agentRuntimesRouter.createCaller({ session: null });

    await expect(caller.harvestCapabilities({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.harvest).not.toHaveBeenCalled();
  });
});
