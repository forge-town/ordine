import { err, ok } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";

const listMcpToolsStdio = vi.fn();
const findById = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock("@repo/agent", () => ({ listMcpToolsStdio: (...a: unknown[]) => listMcpToolsStdio(...a) }));
vi.mock("@repo/models", () => ({
  createConnectorsDao: () => ({ findById, update, create, findMany: vi.fn(), delete: vi.fn() }),
}));

import { createConnectorsService } from "./createConnectorsService";

const svc = () => createConnectorsService({} as never);

const stdioRow = (overrides = {}) => ({
  id: "c1",
  name: "fs",
  method: "mcp",
  status: "needs_setup",
  scopes: null,
  config: { transport: "stdio", command: "npx", args: ["x"] },
  lastSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("connectorsService.connect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("on successful handshake: sets connected + tools + lastSyncAt", async () => {
    findById.mockResolvedValue(stdioRow());
    listMcpToolsStdio.mockResolvedValue(ok([{ name: "read_file", description: "d" }]));
    update.mockImplementation((_id, patch) => Promise.resolve({ ...stdioRow(), ...patch }));

    const result = await svc().connect("c1");

    expect(result.isOk()).toBe(true);
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("connected");
    expect(patch.config.tools).toEqual([{ name: "read_file", description: "d" }]);
    expect(patch.lastSyncAt).toBeInstanceOf(Date);
  });

  it("on handshake failure: sets error + lastError, never connected", async () => {
    findById.mockResolvedValue(stdioRow());
    listMcpToolsStdio.mockResolvedValue(err("boom"));
    update.mockResolvedValue(stdioRow({ status: "error" }));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("error");
    expect(patch.config.lastError).toBe("boom");
  });

  it("on unconfigured (legacy {}) config: errors without claiming connected", async () => {
    findById.mockResolvedValue(stdioRow({ config: {} }));
    update.mockResolvedValue(stdioRow({ status: "error" }));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    expect(update.mock.calls[0]![1].status).toBe("error");
  });

  it("returns NotFound when connector missing", async () => {
    findById.mockResolvedValue(undefined);
    const result = await svc().connect("nope");
    expect(result.isErr()).toBe(true);
  });
});

describe("connectorsService manual-status guard", () => {
  afterEach(() => vi.clearAllMocks());

  it("create coerces a manual connected status to needs_setup", async () => {
    create.mockResolvedValue(stdioRow());
    await svc().create({ name: "x", method: "mcp", status: "connected" } as never);
    expect(create.mock.calls[0]![0].status).toBe("needs_setup");
  });

  it("update coerces a manual connected status to needs_setup", async () => {
    update.mockResolvedValue(stdioRow());
    await svc().update("c1", { status: "connected" } as never);
    expect(update.mock.calls[0]![1].status).toBe("needs_setup");
  });
});
