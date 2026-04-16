import { describe, it, expect, vi } from "vitest";
import { createGithubProjectsService } from "./createGithubProjectsService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "g1" }]),
  findById: vi.fn().mockResolvedValue({ id: "g1" }),
  create: vi.fn().mockResolvedValue({ id: "g1" }),
  update: vi.fn().mockResolvedValue({ id: "g1" }),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe("createGithubProjectsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const svc = createGithubProjectsService(dao as never);
    const result = await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "g1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createGithubProjectsService(dao as never);
    await svc.getById("g1");
    expect(dao.findById).toHaveBeenCalledWith("g1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createGithubProjectsService(dao as never);
    const data = { name: "repo" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createGithubProjectsService(dao as never);
    await svc.update("g1", { name: "new" } as never);
    expect(dao.update).toHaveBeenCalledWith("g1", { name: "new" });
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createGithubProjectsService(dao as never);
    await svc.delete("g1");
    expect(dao.delete).toHaveBeenCalledWith("g1");
  });
});
