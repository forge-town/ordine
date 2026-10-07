import { afterEach, describe, expect, it, vi } from "vitest";

const listMcpToolsStdio = vi.fn();
const listMcpToolsHttp = vi.fn();
const findById = vi.fn();
const update = vi.fn();
const updateIfConfigUnchanged = vi.fn();
const create = vi.fn();

vi.mock("@repo/agent", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  listMcpToolsStdio: (...a: unknown[]) => listMcpToolsStdio(...a),
  listMcpToolsHttp: (...a: unknown[]) => listMcpToolsHttp(...a),
}));
vi.mock("@repo/models", () => ({
  createConnectorsDao: () => ({
    findById,
    update,
    updateIfConfigUnchanged,
    create,
    findMany: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { createConnectorsService } from "../../connectors.service";
import type { ConnectorsServiceOptions } from "../../contracts";

const svc = (options: ConnectorsServiceOptions = {}) =>
  createConnectorsService({} as never, options);

const stdioRow = (overrides = {}) => ({
  id: "c1",
  name: "fs",
  method: "mcp",
  status: "needs_setup",
  scopes: null,
  config: { transport: "stdio", command: "npx", args: ["x"] },
  origin: "manual",
  signature: null,
  sources: [],
  encryptedCredentials: {},
  lastSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("connectorsService manual-status guard", () => {
  afterEach(() => vi.clearAllMocks());

  it("create coerces a manual connected status to needs_setup", async () => {
    create.mockResolvedValue(stdioRow());
    await svc().create({ name: "x", method: "mcp", status: "connected" } as never);
    expect(create.mock.calls[0]![0].status).toBe("needs_setup");
  });
});
