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

import { createAgentRuntimesService } from "../../agentRuntimes.service";

describe("createAgentRuntimesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const runtimeRecord = (id: string) => ({
    id,
    name: id,
    type: "claude-code",
    connection: { mode: "local" },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  });
  it("getById delegates to dao.findById", async () => {
    const svc = createAgentRuntimesService({} as never);
    await svc.getById("rt-1");
    expect(mockDao.findById).toHaveBeenCalledWith("rt-1");
  });
});
