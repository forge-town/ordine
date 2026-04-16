import { describe, it, expect, vi } from "vitest";
import { createBestPracticesService } from "./createBestPracticesService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "1", title: "BP1" }]),
  findById: vi.fn().mockResolvedValue({ id: "1", title: "BP1" }),
  create: vi.fn().mockResolvedValue({ id: "1" }),
  update: vi.fn().mockResolvedValue({ id: "1" }),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe("createBestPracticesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const svc = createBestPracticesService(dao as never);
    const result = await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "1", title: "BP1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createBestPracticesService(dao as never);
    await svc.getById("1");
    expect(dao.findById).toHaveBeenCalledWith("1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createBestPracticesService(dao as never);
    const data = { title: "New" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createBestPracticesService(dao as never);
    await svc.update("1", { title: "Updated" } as never);
    expect(dao.update).toHaveBeenCalledWith("1", { title: "Updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createBestPracticesService(dao as never);
    await svc.delete("1");
    expect(dao.delete).toHaveBeenCalledWith("1");
  });
});
