import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "../../types";
import { createConnectorsDao } from "./connectorsDao";

const connector = {
  id: "connector-1",
  name: "Local MCP",
  method: "mcp" as const,
  status: "connected" as const,
  scopes: null,
  config: {},
  lastSyncAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const returning = vi.fn(() => Promise.resolve([connector]));
const limit = vi.fn(() => Promise.resolve([connector]));
const orderBy = vi.fn(() => Promise.resolve([connector]));
const where = vi.fn(() => ({ limit, returning }));
const from = vi.fn(() => ({ orderBy, where }));
const values = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const executor = {
  select: vi.fn(() => ({ from })),
  insert: vi.fn(() => ({ values })),
  update: vi.fn(() => ({ set })),
  delete: vi.fn(() => ({ where })),
} as unknown as DbExecutor;
const dao = createConnectorsDao(executor);

describe("ConnectorsDao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("implements the standard CRUD interface", async () => {
    await expect(dao.findMany()).resolves.toEqual([connector]);
    await expect(dao.findById(connector.id)).resolves.toEqual(connector);
    await expect(
      dao.create({ id: connector.id, name: connector.name, method: connector.method }),
    ).resolves.toEqual(connector);
    await expect(dao.update(connector.id, { status: "connected" })).resolves.toEqual(connector);
    await expect(dao.delete(connector.id)).resolves.toBeUndefined();

    expect(limit).toHaveBeenCalledWith(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "connected" }));
  });
});
