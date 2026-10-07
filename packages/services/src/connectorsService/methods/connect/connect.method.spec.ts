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

import { createCredentialCipher } from "../../../capabilityHarvestService";
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
