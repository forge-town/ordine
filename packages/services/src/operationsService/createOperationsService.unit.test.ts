import { describe, it, expect, vi } from "vitest";
import { createOperationsService } from "./createOperationsService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "o1" }]),
  findById: vi.fn().mockResolvedValue({ id: "o1" }),
  create: vi.fn().mockResolvedValue({ id: "o1" }),
  update: vi.fn().mockResolvedValue({ id: "o1" }),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe("createOperationsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const svc = createOperationsService(dao as never);
    const result = await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "o1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createOperationsService(dao as never);
    await svc.getById("o1");
    expect(dao.findById).toHaveBeenCalledWith("o1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createOperationsService(dao as never);
    const data = { name: "op" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createOperationsService(dao as never);
    await svc.update("o1", { name: "updated" } as never);
    expect(dao.update).toHaveBeenCalledWith("o1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createOperationsService(dao as never);
    await svc.delete("o1");
    expect(dao.delete).toHaveBeenCalledWith("o1");
  });
});
