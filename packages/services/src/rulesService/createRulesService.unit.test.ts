import { describe, it, expect, vi } from "vitest";
import { createRulesService } from "./createRulesService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "ru1" }]),
  findById: vi.fn().mockResolvedValue({ id: "ru1" }),
  create: vi.fn().mockResolvedValue({ id: "ru1" }),
  update: vi.fn().mockResolvedValue({ id: "ru1" }),
  toggleEnabled: vi.fn().mockResolvedValue({ id: "ru1", enabled: false }),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe("createRulesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const svc = createRulesService(dao as never);
    await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createRulesService(dao as never);
    await svc.getById("ru1");
    expect(dao.findById).toHaveBeenCalledWith("ru1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createRulesService(dao as never);
    const data = { name: "rule" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createRulesService(dao as never);
    await svc.update("ru1", { name: "updated" } as never);
    expect(dao.update).toHaveBeenCalledWith("ru1", { name: "updated" });
  });

  it("toggleEnabled delegates to dao.toggleEnabled", async () => {
    const dao = makeMockDao();
    const svc = createRulesService(dao as never);
    await svc.toggleEnabled("ru1", false);
    expect(dao.toggleEnabled).toHaveBeenCalledWith("ru1", false);
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createRulesService(dao as never);
    await svc.delete("ru1");
    expect(dao.delete).toHaveBeenCalledWith("ru1");
  });
});
