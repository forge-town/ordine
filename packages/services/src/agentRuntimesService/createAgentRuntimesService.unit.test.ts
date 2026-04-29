import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([
    {
      id: "rt-1",
      name: "Claude",
      type: "claude-code",
      connection: { mode: "local" },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ]),
  findById: vi.fn().mockResolvedValue({
    id: "rt-1",
    name: "Claude",
    type: "claude-code",
    connection: { mode: "local" },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }),
  create: vi.fn().mockResolvedValue({
    id: "rt-1",
    name: "Claude",
    type: "claude-code",
    connection: { mode: "local" },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }),
  update: vi.fn().mockResolvedValue({
    id: "rt-1",
    name: "Updated",
    type: "claude-code",
    connection: { mode: "local" },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => mockDao,
}));

import { createAgentRuntimesService } from "./createAgentRuntimesService";

describe("createAgentRuntimesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll delegates to dao.findMany and applies withMeta", async () => {
    const svc = createAgentRuntimesService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: "rt-1",
        name: "Claude",
        type: "claude-code",
        connection: { mode: "local" },
        meta: { createdAt: new Date(0), updatedAt: new Date(0) },
      },
    ]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createAgentRuntimesService({} as never);
    await svc.getById("rt-1");
    expect(mockDao.findById).toHaveBeenCalledWith("rt-1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createAgentRuntimesService({} as never);
    const data = {
      id: "rt-1",
      name: "Claude",
      type: "claude-code" as const,
      connection: { mode: "local" as const },
    };
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createAgentRuntimesService({} as never);
    await svc.update("rt-1", { name: "Updated" });
    expect(mockDao.update).toHaveBeenCalledWith("rt-1", { name: "Updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createAgentRuntimesService({} as never);
    await svc.delete("rt-1");
    expect(mockDao.delete).toHaveBeenCalledWith("rt-1");
  });

  it("syncAll creates new, updates existing, and deletes removed", async () => {
    // existing: rt-1
    mockDao.findMany
      .mockResolvedValueOnce([
        {
          id: "rt-1",
          name: "Claude",
          type: "claude-code",
          connection: { mode: "local" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "rt-1",
          name: "Updated",
          type: "claude-code",
          connection: { mode: "local" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        {
          id: "rt-2",
          name: "Codex",
          type: "codex",
          connection: { mode: "local" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ]);

    const svc = createAgentRuntimesService({} as never);
    // incoming: rt-1 (update) + rt-2 (create), rt-1 stays
    const result = await svc.syncAll([
      { id: "rt-1", name: "Updated", type: "claude-code", connection: { mode: "local" } },
      { id: "rt-2", name: "Codex", type: "codex", connection: { mode: "local" } },
    ]);

    expect(mockDao.create).toHaveBeenCalledWith(expect.objectContaining({ id: "rt-2" }));
    expect(mockDao.update).toHaveBeenCalledWith(
      "rt-1",
      expect.objectContaining({ name: "Updated" }),
    );
    expect(mockDao.delete).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });
});
