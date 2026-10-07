import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi
    .fn()
    .mockResolvedValue([{ id: "g1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "g1", createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "g1", createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "g1", createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createGithubProjectsDao: () => mockDao,
}));

import { createGithubProjectsService } from "../../githubProjects.service";

describe("createGithubProjectsService", () => {
  it("delete delegates to dao.delete", async () => {
    const svc = createGithubProjectsService({} as never);
    await svc.delete("g1");
    expect(mockDao.delete).toHaveBeenCalledWith("g1");
  });
});
