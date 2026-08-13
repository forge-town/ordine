import { err, ok } from "neverthrow";
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

import { createCredentialCipher } from "../capabilityHarvestService";
import { createConnectorsService, type ConnectorsServiceOptions } from "./createConnectorsService";

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

describe("connectorsService.connect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("on successful stdio handshake: sets connected + tools + lastSyncAt, preserving other config fields", async () => {
    const config = { transport: "stdio", command: "npx", args: ["x"], custom: "keep-me" };
    findById.mockResolvedValue(stdioRow({ config }));
    listMcpToolsStdio.mockResolvedValue(ok([{ name: "read_file", description: "d" }]));
    updateIfConfigUnchanged.mockImplementation((_id, patch) =>
      Promise.resolve({ ...stdioRow(), ...patch }),
    );

    const result = await svc().connect("c1");

    expect(result.isOk()).toBe(true);
    expect(updateIfConfigUnchanged).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        status: "connected",
        config: expect.objectContaining({
          tools: [{ name: "read_file", description: "d" }],
          custom: "keep-me",
        }),
        lastSyncAt: expect.any(Date),
      }),
      "mcp",
      config,
    );
    const patch = updateIfConfigUnchanged.mock.calls[0]![1];
    expect(patch.config.lastError).toBeUndefined();
    expect(listMcpToolsHttp).not.toHaveBeenCalled();
  });

  it("on successful http handshake: sets connected + tools + lastSyncAt", async () => {
    const config = {
      transport: "http",
      url: "https://x/mcp",
      headers: { authorization: "Bearer token" },
    };
    findById.mockResolvedValue(stdioRow({ config }));
    listMcpToolsHttp.mockResolvedValue(ok([{ name: "create_issue" }]));
    updateIfConfigUnchanged.mockImplementation((_id, patch) =>
      Promise.resolve({ ...stdioRow(), ...patch }),
    );

    const result = await svc().connect("c1");

    expect(result.isOk()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    expect(listMcpToolsHttp).toHaveBeenCalledWith({
      url: "https://x/mcp",
      headers: { authorization: "Bearer token" },
    });
    const patch = updateIfConfigUnchanged.mock.calls[0]![1];
    expect(patch.status).toBe("connected");
    expect(patch.config.tools).toEqual([{ name: "create_issue" }]);
    expect(patch.lastSyncAt).toBeInstanceOf(Date);
  });

  it("uses harvested credentials for the handshake without persisting or returning plaintext", async () => {
    const sourceKey = "codex-source";
    const cipher = createCredentialCipher("unit-test-encryption-key");
    expect(cipher.isOk()).toBe(true);
    if (cipher.isErr()) throw cipher.error;
    const envelope = cipher.value.encrypt(sourceKey, {
      headers: { Authorization: "Bearer runtime-only-value" },
    });
    expect(envelope.isOk()).toBe(true);
    if (envelope.isErr()) throw envelope.error;
    const row = stdioRow({
      origin: "harvested",
      config: { transport: "http", url: "https://x/mcp" },
      sources: [
        {
          sourceKey,
          source: "codex",
          scope: "global",
          path: "/home/test/.codex/config.toml",
          nativeName: "github",
          enabled: true,
          lastSeenAt: "2026-08-13T00:00:00.000Z",
        },
      ],
      encryptedCredentials: { [sourceKey]: envelope.value },
    });
    findById.mockResolvedValue(row);
    listMcpToolsHttp.mockResolvedValue(ok([{ name: "read_issue" }]));
    updateIfConfigUnchanged.mockImplementation((_id, patch) =>
      Promise.resolve({ ...row, ...patch }),
    );

    const result = await svc({ encryptionSecret: "unit-test-encryption-key" }).connect("c1", {
      preferredSource: "codex",
    });

    expect(result.isOk()).toBe(true);
    expect(listMcpToolsHttp).toHaveBeenCalledWith({
      url: "https://x/mcp",
      headers: { Authorization: "Bearer runtime-only-value" },
    });
    const persistedPatch = updateIfConfigUnchanged.mock.calls[0]![1];
    expect(JSON.stringify(persistedPatch)).not.toContain("runtime-only-value");
    expect(result._unsafeUnwrap()).not.toHaveProperty("encryptedCredentials");
    expect(JSON.stringify(result._unsafeUnwrap())).not.toContain("runtime-only-value");
  });

  it("on stdio handshake failure with valid config: sets error + lastError, never connected", async () => {
    findById.mockResolvedValue(stdioRow());
    listMcpToolsStdio.mockResolvedValue(err("boom"));
    updateIfConfigUnchanged.mockResolvedValue(stdioRow({ status: "error" }));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    const patch = updateIfConfigUnchanged.mock.calls[0]![1];
    expect(patch.status).toBe("error");
    expect(patch.config.lastError).toBe("boom");
  });

  it("on http handshake failure: sets error + lastError, never connected", async () => {
    findById.mockResolvedValue(stdioRow({ config: { transport: "http", url: "https://x/mcp" } }));
    listMcpToolsHttp.mockResolvedValue(err("unauthorized"));
    updateIfConfigUnchanged.mockResolvedValue(stdioRow({ status: "error" }));

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    const patch = updateIfConfigUnchanged.mock.calls[0]![1];
    expect(patch.status).toBe("error");
    expect(patch.config.lastError).toBe("unauthorized");
  });

  it("on unconfigured (legacy {}) config: falls back to needs_setup + lastError without handshaking", async () => {
    findById.mockResolvedValue(stdioRow({ config: {} }));
    updateIfConfigUnchanged.mockResolvedValue(stdioRow());

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    expect(listMcpToolsHttp).not.toHaveBeenCalled();
    const patch = updateIfConfigUnchanged.mock.calls[0]![1];
    expect(patch.status).toBe("needs_setup");
    expect(patch.config.lastError).toContain("not configured");
  });

  it("on non-mcp method: falls back to needs_setup + lastError without handshaking", async () => {
    findById.mockResolvedValue(stdioRow({ method: "direct-api" }));
    updateIfConfigUnchanged.mockResolvedValue(stdioRow());

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(listMcpToolsStdio).not.toHaveBeenCalled();
    expect(listMcpToolsHttp).not.toHaveBeenCalled();
    const patch = updateIfConfigUnchanged.mock.calls[0]![1];
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
    expect(updateIfConfigUnchanged).toHaveBeenCalledWith("c1", expect.anything(), "mcp", config);
  });

  it("returns Conflict when a handshake failure races with a config edit", async () => {
    findById.mockResolvedValueOnce(stdioRow()).mockResolvedValueOnce(stdioRow());
    listMcpToolsStdio.mockResolvedValue(err("boom"));
    updateIfConfigUnchanged.mockResolvedValue(undefined);

    const result = await svc().connect("c1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().name).toBe("ConflictError");
    expect(updateIfConfigUnchanged).toHaveBeenCalledTimes(1);
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
