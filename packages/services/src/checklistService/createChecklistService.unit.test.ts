import { describe, it, expect, vi } from "vitest";
import { createChecklistService } from "./createChecklistService";

const makeMockItemsDao = () => ({
  findByBestPracticeId: vi.fn().mockResolvedValue([{ id: "i1" }]),
  findById: vi.fn().mockResolvedValue({ id: "i1" }),
  create: vi.fn().mockResolvedValue({ id: "i1" }),
  update: vi.fn().mockResolvedValue({ id: "i1" }),
  delete: vi.fn().mockResolvedValue(undefined),
});

const makeMockResultsDao = () => ({
  findByJobId: vi.fn().mockResolvedValue([{ id: "r1" }]),
  create: vi.fn().mockResolvedValue({ id: "r1" }),
});

describe("createChecklistService", () => {
  it("getItemsByBestPracticeId delegates to itemsDao", async () => {
    const itemsDao = makeMockItemsDao();
    const resultsDao = makeMockResultsDao();
    const svc = createChecklistService(itemsDao as never, resultsDao as never);
    await svc.getItemsByBestPracticeId("bp1");
    expect(itemsDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
  });

  it("getItemById delegates to itemsDao.findById", async () => {
    const itemsDao = makeMockItemsDao();
    const resultsDao = makeMockResultsDao();
    const svc = createChecklistService(itemsDao as never, resultsDao as never);
    await svc.getItemById("i1");
    expect(itemsDao.findById).toHaveBeenCalledWith("i1");
  });

  it("createItem delegates to itemsDao.create", async () => {
    const itemsDao = makeMockItemsDao();
    const resultsDao = makeMockResultsDao();
    const svc = createChecklistService(itemsDao as never, resultsDao as never);
    const data = { title: "check" } as never;
    await svc.createItem(data);
    expect(itemsDao.create).toHaveBeenCalledWith(data);
  });

  it("deleteItem delegates to itemsDao.delete", async () => {
    const itemsDao = makeMockItemsDao();
    const resultsDao = makeMockResultsDao();
    const svc = createChecklistService(itemsDao as never, resultsDao as never);
    await svc.deleteItem("i1");
    expect(itemsDao.delete).toHaveBeenCalledWith("i1");
  });

  it("getResultsByJobId delegates to resultsDao", async () => {
    const itemsDao = makeMockItemsDao();
    const resultsDao = makeMockResultsDao();
    const svc = createChecklistService(itemsDao as never, resultsDao as never);
    await svc.getResultsByJobId("j1");
    expect(resultsDao.findByJobId).toHaveBeenCalledWith("j1");
  });

  it("createResult delegates to resultsDao.create", async () => {
    const itemsDao = makeMockItemsDao();
    const resultsDao = makeMockResultsDao();
    const svc = createChecklistService(itemsDao as never, resultsDao as never);
    const data = { status: "pass" } as never;
    await svc.createResult(data);
    expect(resultsDao.create).toHaveBeenCalledWith(data);
  });
});
