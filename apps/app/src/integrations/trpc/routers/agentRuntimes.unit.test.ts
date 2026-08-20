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
vi.mock("@repo/agent", () => ({ scanRuntimes: mocks.scanRuntimes }));

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
