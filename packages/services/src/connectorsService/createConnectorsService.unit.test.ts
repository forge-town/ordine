import { err, ok } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";

const listMcpToolsStdio = vi.fn();
const findById = vi.fn();
const update = vi.fn();
const updateIfConfigUnchanged = vi.fn();
const create = vi.fn();

vi.mock("@repo/agent", () => ({ listMcpToolsStdio: (...a: unknown[]) => listMcpToolsStdio(...a) }));
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

  it("on successful handshake: sets connected + tools + lastSyncAt, preserving other config fields", async () => {
    const config = { transport: "stdio", command: "npx", args: ["x"], custom: "keep-me" };
    findById.mockResolvedValue(stdioRow({ config }));
    listMcpToolsStdio.mockResolvedValue(ok([{ name: "read_file", description: "d" }]));
    updateIfConfigUnchanged.mockImplementation((_id, patch) => Promise.resolve({ ...stdioRow(), ...patch }));

    const result = await svc().connect("c1");

    expect(result.isOk()).toBe(true);
    expect(updateIfConfigUnchanged).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        status: "connected",
        config: expect.objectContaining({ tools: [{ name: "read_file", description: "d" }], custom: "keep-me" }),
        lastSyncAt: expect.any(Date),
      }),
      "mcp",
      config,
    );
    const patch = updateIfConfigUnchanged.mock.calls[0]![1];
    expect(patch.config.lastError).toBeUndefined();
  });

  it("on handshake failure with valid config: sets error + lastError, never connected", async () => {
    findById.mockResolvedValue(stdioRow());
    listMcpToolsStdio.mockResolvedValue(err("boom"));
    update.mockResolvedValue(stdioRow({ status: "error" }));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("error");
    expect(patch.config.lastError).toBe("boom");
  });

  it("on unconfigured (legacy {}) config: falls back to needs_setup + lastError without handshaking", async () => {
    findById.mockResolvedValue(stdioRow({ config: {} }));
    update.mockResolvedValue(stdioRow());

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.lastError).toContain("not configured");
  });

  it("on http transport: falls back to needs_setup + lastError (not error) without handshaking", async () => {
    findById.mockResolvedValue(stdioRow({ config: { transport: "http", url: "https://x/sse" } }));
    update.mockResolvedValue(stdioRow());

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.lastError).toBe("http transport is not supported yet");
  });

  it("on non-mcp method: falls back to needs_setup + lastError without handshaking", async () => {
    findById.mockResolvedValue(stdioRow({ method: "direct-api" }));
    update.mockResolvedValue(stdioRow());

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.lastError).toContain("does not support MCP handshake");
  });

  it("discards a stale handshake when the config changed mid-flight", async () => {
    findById
      .mockResolvedValueOnce(stdioRow())
      .mockResolvedValueOnce(
        stdioRow({ config: { transport: "stdio", command: "changed-command" } }),
      );
    listMcpToolsStdio.mockResolvedValue(ok([{ name: "read_file" }]));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("changed during handshake");
    expect(updateIfConfigUnchanged).not.toHaveBeenCalled();
  });

  it("returns a conflict when the connector is edited between re-read and final write", async () => {
    const config = { transport: "stdio", command: "npx", args: ["x"] };
    findById.mockResolvedValue(stdioRow({ config }));
    listMcpToolsStdio.mockResolvedValue(ok([{ name: "read_file" }]));
    updateIfConfigUnchanged.mockResolvedValue(undefined);

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("changed during handshake");
    expect(updateIfConfigUnchanged).toHaveBeenCalledWith(
      "c1",
      expect.anything(),
      "mcp",
      config,
    );
  });

  it("returns NotFound when connector missing", async () => {
    findById.mockResolvedValue(undefined);
    const result = await svc().connect("nope");
    expect(result.isErr()).toBe(true);
  });

  it("normalizes DAO rejections into an err Result instead of a rejected promise", async () => {
    findById.mockRejectedValue(new Error("db down"));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().name).toBe("ServiceError");
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
    findById.mockResolvedValue(stdioRow());
    update.mockResolvedValue(stdioRow());
    await svc().update("c1", { status: "connected" } as never);
    expect(update.mock.calls[0]![1].status).toBe("needs_setup");
  });

  it("update with config drops connected status and strips forged tools", async () => {
    findById.mockResolvedValue(stdioRow());
    update.mockResolvedValue(stdioRow());
    await svc().update("c1", {
      status: "connected",
      config: {
        transport: "stdio",
        command: "npx",
        tools: [{ name: "forged_tool" }],
      },
    } as never);

    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.tools).toBeUndefined();
    expect(patch.config.command).toBe("npx");
    expect(patch.lastSyncAt).toBeNull();
  });

  it("update with config resets status to needs_setup even when no status is given", async () => {
    findById.mockResolvedValue(stdioRow());
    update.mockResolvedValue(stdioRow());
    await svc().update("c1", {
      config: { transport: "stdio", command: "other" },
    } as never);

    expect(update.mock.calls[0]![1].status).toBe("needs_setup");
  });
});

describe("connectorsService method-change invalidation", () => {
  afterEach(() => vi.clearAllMocks());

  it("update that changes method resets status to needs_setup and clears handshake state", async () => {
    findById.mockResolvedValue(
      stdioRow({
        status: "connected",
        config: { transport: "stdio", command: "npx", tools: [{ name: "tool" }] },
        lastSyncAt: new Date(),
      }),
    );
    update.mockResolvedValue(stdioRow());

    await svc().update("c1", { method: "direct-api" } as never);

    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.tools).toBeUndefined();
    expect(patch.config.command).toBe("npx");
    expect(patch.lastSyncAt).toBeNull();
  });

  it("update that keeps method does not touch existing config", async () => {
    findById.mockResolvedValue(
      stdioRow({
        status: "connected",
        config: { transport: "stdio", command: "npx", tools: [{ name: "tool" }] },
        lastSyncAt: new Date(),
      }),
    );
    update.mockResolvedValue(stdioRow());

    await svc().update("c1", { name: "renamed" } as never);

    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBeUndefined();
    expect(patch.config).toBeUndefined();
    expect(patch.lastSyncAt).toBeUndefined();
  });
});
