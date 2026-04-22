import { describe, it, expect, vi } from "vitest";
import type { DbConnection } from "@repo/models";

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

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createCodeSnippetsService", () => {
  it("getByBestPracticeId delegates to dao", async () => {
    const svc = createCodeSnippetsService(mockDb);
    await svc.getByBestPracticeId("bp1");
    expect(mockDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createCodeSnippetsService(mockDb);
    await svc.getById("s1");
    expect(mockDao.findById).toHaveBeenCalledWith("s1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createCodeSnippetsService(mockDb);
    const data = { code: "x" } as Parameters<typeof svc.create>[0];
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createCodeSnippetsService(mockDb);
    await svc.update("s1", { code: "y" });
    expect(mockDao.update).toHaveBeenCalledWith("s1", { code: "y" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createCodeSnippetsService(mockDb);
    await svc.delete("s1");
    expect(mockDao.delete).toHaveBeenCalledWith("s1");
  });

  it("deleteByBestPracticeId delegates to dao", async () => {
    const svc = createCodeSnippetsService(mockDb);
    await svc.deleteByBestPracticeId("bp1");
    expect(mockDao.deleteByBestPracticeId).toHaveBeenCalledWith("bp1");
  });
});
