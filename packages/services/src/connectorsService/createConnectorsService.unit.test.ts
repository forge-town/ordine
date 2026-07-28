import { err, ok } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";

const listMcpToolsStdio = vi.fn();
const listMcpToolsHttp = vi.fn();
const findById = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock("@repo/agent", () => ({
  listMcpToolsStdio: (...a: unknown[]) => listMcpToolsStdio(...a),
  listMcpToolsHttp: (...a: unknown[]) => listMcpToolsHttp(...a),
}));
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

  it("on successful handshake: sets connected + tools + lastSyncAt, preserving other config fields", async () => {
    const config = { transport: "stdio", command: "npx", args: ["x"], custom: "keep-me" };
    findById.mockResolvedValue(stdioRow({ config }));
    listMcpToolsStdio.mockResolvedValue(ok([{ name: "read_file", description: "d" }]));
    update.mockImplementation((_id, patch) => Promise.resolve({ ...stdioRow(), ...patch }));

    const result = await svc().connect("c1");

    expect(result.isOk()).toBe(true);
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("connected");
    expect(patch.config.tools).toEqual([{ name: "read_file", description: "d" }]);
    expect(patch.config.custom).toBe("keep-me");
    expect(patch.config.lastError).toBeUndefined();
    expect(patch.lastSyncAt).toBeInstanceOf(Date);
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

  it("on successful http handshake: sets connected + tools + lastSyncAt", async () => {
    const config = {
      transport: "http",
      url: "https://x/mcp",
      headers: { authorization: "Bearer token" },
    };
    findById.mockResolvedValue(stdioRow({ config }));
    listMcpToolsHttp.mockResolvedValue(ok([{ name: "create_issue" }]));
    update.mockImplementation((_id, patch) => Promise.resolve({ ...stdioRow(), ...patch }));

    const result = await svc().connect("c1");

    expect(result.isOk()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    expect(listMcpToolsHttp).toHaveBeenCalledWith({
      url: "https://x/mcp",
      headers: { authorization: "Bearer token" },
    });
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("connected");
    expect(patch.config.tools).toEqual([{ name: "create_issue" }]);
    expect(patch.lastSyncAt).toBeInstanceOf(Date);
  });

  it("on http handshake failure: sets error + lastError, never connected", async () => {
    findById.mockResolvedValue(stdioRow({ config: { transport: "http", url: "https://x/mcp" } }));
    listMcpToolsHttp.mockResolvedValue(err("unauthorized"));
    update.mockResolvedValue(stdioRow({ status: "error" }));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    const patch = update.mock.calls[0]![1];
    expect(patch.status).toBe("error");
    expect(patch.config.lastError).toBe("unauthorized");
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
    expect(update).not.toHaveBeenCalled();
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
    update.mockResolvedValue(stdioRow());
    await svc().update("c1", { status: "connected" } as never);
    expect(update.mock.calls[0]![1].status).toBe("needs_setup");
  });

  it("update with config drops connected status and strips forged tools", async () => {
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
  });

  it("update with config resets status to needs_setup even when no status is given", async () => {
    update.mockResolvedValue(stdioRow());
    await svc().update("c1", {
      config: { transport: "stdio", command: "other" },
    } as never);

    expect(update.mock.calls[0]![1].status).toBe("needs_setup");
  });
});
