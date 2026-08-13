import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
  process.env.ORDINE_LOCAL_MODE = "true";
  process.env.PGLITE_DATA_DIR = "/tmp/ordine-agent-runtimes-router-test";
  process.env.RUNTIME_SCAN_MODE = "local";
});

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  scanRuntimes: vi.fn(),
  syncAll: vi.fn(),
}));

vi.mock("../services", () => ({
  agentRuntimesService: {
    getAll: mocks.getAll,
    syncAll: mocks.syncAll,
  },
}));
vi.mock("@repo/agent", () => ({ scanRuntimes: mocks.scanRuntimes }));

import { agentRuntimesRouter } from "./agentRuntimes";

describe("agentRuntimesRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("does not rescan once persisted runtimes exist", async () => {
    const existing = [{ id: "local-codex" }];
    mocks.getAll.mockResolvedValue(existing);

    await expect(agentRuntimesRouter.createCaller({ session: null }).getMany()).resolves.toBe(
      existing,
    );
    expect(mocks.scanRuntimes).not.toHaveBeenCalled();
    expect(mocks.syncAll).not.toHaveBeenCalled();
  });
});
