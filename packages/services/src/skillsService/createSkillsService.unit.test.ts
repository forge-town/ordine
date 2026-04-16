import { describe, it, expect, vi } from "vitest";
import { createSkillsService } from "./createSkillsService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "sk1" }]),
  findById: vi.fn().mockResolvedValue({ id: "sk1" }),
  findByName: vi.fn().mockResolvedValue({ id: "sk1", name: "lint" }),
  create: vi.fn().mockResolvedValue({ id: "sk1" }),
  update: vi.fn().mockResolvedValue({ id: "sk1" }),
  delete: vi.fn().mockResolvedValue(undefined),
  seedIfEmpty: vi.fn().mockResolvedValue(undefined),
});

describe("createSkillsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const svc = createSkillsService(dao as never);
    const result = await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "sk1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createSkillsService(dao as never);
    await svc.getById("sk1");
    expect(dao.findById).toHaveBeenCalledWith("sk1");
  });

  it("getByName delegates to dao.findByName", async () => {
    const dao = makeMockDao();
    const svc = createSkillsService(dao as never);
    await svc.getByName("lint");
    expect(dao.findByName).toHaveBeenCalledWith("lint");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createSkillsService(dao as never);
    const data = { name: "skill" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createSkillsService(dao as never);
    await svc.update("sk1", { name: "updated" } as never);
    expect(dao.update).toHaveBeenCalledWith("sk1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createSkillsService(dao as never);
    await svc.delete("sk1");
    expect(dao.delete).toHaveBeenCalledWith("sk1");
  });

  it("seedIfEmpty delegates to dao.seedIfEmpty", async () => {
    const dao = makeMockDao();
    const svc = createSkillsService(dao as never);
    await svc.seedIfEmpty();
    expect(dao.seedIfEmpty).toHaveBeenCalled();
  });
});
