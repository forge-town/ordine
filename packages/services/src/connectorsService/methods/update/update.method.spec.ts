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

  it("update coerces a manual connected status to needs_setup", async () => {
    findById.mockResolvedValue(stdioRow());
    update.mockResolvedValue(stdioRow());

    await svc().update("c1", { status: "connected" } as never);

    expect(update.mock.calls[0]![1].status).toBe("needs_setup");
  });

  it("update with config drops connected status, strips forged tools, and clears sync state", async () => {
    findById.mockResolvedValue(
      stdioRow({
        method: "mcp",
        status: "connected",
        lastSyncAt: new Date("2026-01-01"),
        config: {
          transport: "stdio",
          command: "npx",
          tools: [{ name: "real_tool" }],
          lastError: "old boom",
          custom: "keep",
        },
      }),
    );
    updateIfConfigUnchanged.mockResolvedValue(stdioRow());

    await svc().update("c1", {
      status: "connected",
      config: {
        transport: "stdio",
        command: "npx",
        tools: [{ name: "forged_tool" }],
        lastError: "forged",
      },
    } as never);

    const [id, patch, method, config] = updateIfConfigUnchanged.mock.calls[0]!;
    expect(id).toBe("c1");
    expect(method).toBe("mcp");
    expect(config).toEqual({
      transport: "stdio",
      command: "npx",
      tools: [{ name: "real_tool" }],
      lastError: "old boom",
      custom: "keep",
    });
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.tools).toBeUndefined();
    expect(patch.config.lastError).toBeUndefined();
    expect(patch.config.command).toBe("npx");
    expect(patch.lastSyncAt).toBeNull();
  });

  it("update with method change resets handshake state using a config snapshot CAS", async () => {
    findById.mockResolvedValue(
      stdioRow({
        method: "mcp",
        status: "connected",
        lastSyncAt: new Date("2026-01-01"),
        config: {
          transport: "stdio",
          command: "npx",
          tools: [{ name: "real_tool" }],
          lastError: "old boom",
          custom: "keep",
        },
      }),
    );
    updateIfConfigUnchanged.mockResolvedValue(
      stdioRow({ method: "direct-api", status: "needs_setup" }),
    );

    await svc().update("c1", { method: "direct-api" } as never);

    const [id, patch, method] = updateIfConfigUnchanged.mock.calls[0]!;
    expect(id).toBe("c1");
    expect(method).toBe("mcp");
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.tools).toBeUndefined();
    expect(patch.config.lastError).toBeUndefined();
    expect(patch.config.custom).toBe("keep");
    expect(patch.lastSyncAt).toBeNull();
  });

  it("update with config resets status to needs_setup even when no status is given", async () => {
    findById.mockResolvedValue(stdioRow());
    updateIfConfigUnchanged.mockResolvedValue(stdioRow());

    await svc().update("c1", {
      config: { transport: "stdio", command: "other" },
    } as never);

    expect(updateIfConfigUnchanged.mock.calls[0]![1].status).toBe("needs_setup");
  });

  it("turns an edited harvested connector into a manual connector and detaches source secrets", async () => {
    findById.mockResolvedValue(
      stdioRow({
        origin: "harvested",
        signature: "harvest-signature",
        sources: [{ sourceKey: "source-a" }],
        encryptedCredentials: { "source-a": { ciphertext: "opaque" } },
      }),
    );
    updateIfConfigUnchanged.mockResolvedValue(stdioRow());

    await svc().update("c1", {
      config: { transport: "stdio", command: "my-custom-command" },
    } as never);

    expect(updateIfConfigUnchanged.mock.calls[0]![1]).toMatchObject({
      origin: "manual",
      signature: null,
      sources: [],
      encryptedCredentials: {},
    });
  });

  it("update returns Conflict when a method/config snapshot is stale", async () => {
    findById
      .mockResolvedValueOnce(stdioRow({ config: { transport: "stdio", command: "npx" } }))
      .mockResolvedValueOnce(stdioRow({ config: { transport: "stdio", command: "changed" } }));
    updateIfConfigUnchanged.mockResolvedValue(undefined);

    const result = await svc().update("c1", {
      config: { transport: "stdio", command: "other" },
    } as never);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().name).toBe("ConflictError");
    expect(updateIfConfigUnchanged).toHaveBeenCalledTimes(1);
  });
});
