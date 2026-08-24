import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  getAllRuntimes: vi.fn(),
  getRuntimeById: vi.fn(),
  scanRuntimeCatalog: vi.fn(),
  syncRuntimes: vi.fn(),
}));
const env = vi.hoisted(() => ({
  DESKTOP_MODE: false,
  DESKTOP_AUTH_TOKEN: undefined as string | undefined,
}));
vi.mock("../../src/services.js", () => ({
  agentRunsService: { start: mocks.start },
  agentRuntimesService: {
    getAll: mocks.getAllRuntimes,
    getById: mocks.getRuntimeById,
    syncAll: mocks.syncRuntimes,
  },
}));
vi.mock("../../src/integrations/env/index.js", () => ({ getEnv: () => env }));
vi.mock("@repo/agent", () => ({
  createRuntimeCatalogCache: ({ load }: { load: () => Promise<unknown[]> }) => ({
    get: (seed?: unknown[]) => Promise.resolve(seed ?? []),
    refresh: load,
    warm: vi.fn(),
  }),
  projectRuntimeCatalogFromConfigs: (runtimes: Array<Record<string, unknown>>) =>
    runtimes.map((runtime) => ({
      runtime: runtime.type,
      displayName: runtime.name,
      runtimeConfigId: runtime.id,
      availability: "launchable",
      binaryName: "codex.exe",
      path: "C:/tools/codex.exe",
      version: "0.149.0",
      authenticationStatus: "unknown",
      authenticationMessage: null,
      diagnostics: [],
      models: [],
      modelsSource: "none",
      supportsCustomModel: true,
      compatibility: { runtime: runtime.type },
    })),
  scanRuntimeCatalog: mocks.scanRuntimeCatalog,
}));

import { agentRuntimesRoutes, resolveDesktopMcpSidecarPath } from "../../src/routes/agentRuntimes";

const makeApp = () => {
  const app = new Hono();
  app.route("/agent-runtimes", agentRuntimesRoutes);

  return app;
};

describe("agentRuntimesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllRuntimes.mockResolvedValue([]);
    mocks.scanRuntimeCatalog.mockResolvedValue([]);
    env.DESKTOP_MODE = false;
    env.DESKTOP_AUTH_TOKEN = undefined;
  });

  it("derives the target-suffixed MCP sidecar next to the packaged server", () => {
    expect(
      resolveDesktopMcpSidecarPath(
        undefined,
        "C:\\Program Files\\ORDINE\\ordine-server-x86_64-pc-windows-msvc.exe",
        "win32",
      ),
    ).toBe("C:\\Program Files\\ORDINE\\ordine-mcp-x86_64-pc-windows-msvc.exe");
    expect(resolveDesktopMcpSidecarPath("D:\\custom\\ordine-mcp.exe", "ignored", "win32")).toBe(
      "D:\\custom\\ordine-mcp.exe",
    );
    expect(
      resolveDesktopMcpSidecarPath(
        undefined,
        "/opt/ordine/ordine-server-x86_64-unknown-linux-gnu",
        "linux",
      ),
    ).toBe("/opt/ordine/ordine-mcp-x86_64-unknown-linux-gnu");
  });

  it("serves the persisted catalog seed without waiting for a CLI scan", async () => {
    mocks.getAllRuntimes.mockResolvedValue([
      {
        id: "saved-codex",
        name: "Codex CLI",
        type: "codex",
        connection: { mode: "local", path: "C:/tools/codex.exe" },
      },
    ]);

    const response = await makeApp().request("/agent-runtimes/catalog");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({
        runtime: "codex",
        runtimeConfigId: "saved-codex",
        availability: "launchable",
      }),
    ]);
    expect(mocks.scanRuntimeCatalog).not.toHaveBeenCalled();
  });

  it("starts a real read-only model probe and returns 202", async () => {
    mocks.start.mockResolvedValue({ runId: "run-1" });
    const response = await makeApp().request("/agent-runtimes/local-codex/connection-tests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.6" }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ runId: "run-1" });
    expect(mocks.start).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeConfigId: "local-codex",
        model: "gpt-5.6",
        permissionMode: "read-only",
        networkAccess: true,
      }),
    );
  });

  it("rejects malformed input before consuming model quota", async () => {
    const response = await makeApp().request("/agent-runtimes/local-codex/connection-tests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("returns a copyable command instead of mutating global config in Web mode", async () => {
    mocks.getRuntimeById.mockResolvedValue({ id: "local-codex", type: "codex" });
    const response = await makeApp().request("/agent-runtimes/local-codex/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "install" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        code: "MCP_DESKTOP_ONLY",
        copyCommand: "ordine mcp install codex",
      }),
    );
  });
});
