import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findByBestPracticeId: vi.fn().mockResolvedValue([{ id: "s1" }]),
  findById: vi.fn().mockResolvedValue({ id: "s1" }),
  create: vi.fn().mockResolvedValue({ id: "s1" }),
  update: vi.fn().mockResolvedValue({ id: "s1" }),
  delete: vi.fn().mockResolvedValue(undefined),
  deleteByBestPracticeId: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createCodeSnippetsDao: () => mockDao,
}));

import { createCodeSnippetsService } from "./createCodeSnippetsService";

describe("createCodeSnippetsService", () => {
  it("getByBestPracticeId delegates to dao", async () => {
    const svc = createCodeSnippetsService({} as never);
    await svc.getByBestPracticeId("bp1");
    expect(mockDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createCodeSnippetsService({} as never);
    await svc.getById("s1");
    expect(mockDao.findById).toHaveBeenCalledWith("s1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createCodeSnippetsService({} as never);
    const data = { code: "x" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createCodeSnippetsService({} as never);
    await svc.update("s1", { code: "y" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("s1", { code: "y" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createCodeSnippetsService({} as never);
    await svc.delete("s1");
    expect(mockDao.delete).toHaveBeenCalledWith("s1");
  });

  it("deleteByBestPracticeId delegates to dao", async () => {
    const svc = createCodeSnippetsService({} as never);
    await svc.deleteByBestPracticeId("bp1");
    expect(mockDao.deleteByBestPracticeId).toHaveBeenCalledWith("bp1");
  });
});
