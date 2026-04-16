import { describe, it, expect, vi } from "vitest";

const mockItemsDao = {
  findByBestPracticeId: vi.fn().mockResolvedValue([{ id: "i1" }]),
  findById: vi.fn().mockResolvedValue({ id: "i1" }),
  create: vi.fn().mockResolvedValue({ id: "i1" }),
  update: vi.fn().mockResolvedValue({ id: "i1" }),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockResultsDao = {
  findByJobId: vi.fn().mockResolvedValue([{ id: "r1" }]),
  create: vi.fn().mockResolvedValue({ id: "r1" }),
};

vi.mock("@repo/models", () => ({
  createChecklistItemsDao: () => mockItemsDao,
  createChecklistResultsDao: () => mockResultsDao,
}));

import { createChecklistService } from "./createChecklistService";

describe("createChecklistService", () => {
  it("getItemsByBestPracticeId delegates to itemsDao", async () => {
    const svc = createChecklistService({} as never);
    await svc.getItemsByBestPracticeId("bp1");
    expect(mockItemsDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
  });

  it("getItemById delegates to itemsDao.findById", async () => {
    const svc = createChecklistService({} as never);
    await svc.getItemById("i1");
    expect(mockItemsDao.findById).toHaveBeenCalledWith("i1");
  });

  it("createItem delegates to itemsDao.create", async () => {
    const svc = createChecklistService({} as never);
    const data = { title: "check" } as never;
    await svc.createItem(data);
    expect(mockItemsDao.create).toHaveBeenCalledWith(data);
  });

  it("deleteItem delegates to itemsDao.delete", async () => {
    const svc = createChecklistService({} as never);
    await svc.deleteItem("i1");
    expect(mockItemsDao.delete).toHaveBeenCalledWith("i1");
  });

  it("getResultsByJobId delegates to resultsDao", async () => {
    const svc = createChecklistService({} as never);
    await svc.getResultsByJobId("j1");
    expect(mockResultsDao.findByJobId).toHaveBeenCalledWith("j1");
  });

  it("createResult delegates to resultsDao.create", async () => {
    const svc = createChecklistService({} as never);
    const data = { status: "pass" } as never;
    await svc.createResult(data);
    expect(mockResultsDao.create).toHaveBeenCalledWith(data);
  });
});
