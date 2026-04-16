import { describe, it, expect, vi } from "vitest";
import { createCodeSnippetsService } from "./createCodeSnippetsService";

const makeMockDao = () => ({
  findByBestPracticeId: vi.fn().mockResolvedValue([{ id: "s1" }]),
  findById: vi.fn().mockResolvedValue({ id: "s1" }),
  create: vi.fn().mockResolvedValue({ id: "s1" }),
  update: vi.fn().mockResolvedValue({ id: "s1" }),
  delete: vi.fn().mockResolvedValue(undefined),
  deleteByBestPracticeId: vi.fn().mockResolvedValue(undefined),
});

describe("createCodeSnippetsService", () => {
  it("getByBestPracticeId delegates to dao", async () => {
    const dao = makeMockDao();
    const svc = createCodeSnippetsService(dao as never);
    await svc.getByBestPracticeId("bp1");
    expect(dao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createCodeSnippetsService(dao as never);
    await svc.getById("s1");
    expect(dao.findById).toHaveBeenCalledWith("s1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createCodeSnippetsService(dao as never);
    const data = { code: "x" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createCodeSnippetsService(dao as never);
    await svc.update("s1", { code: "y" } as never);
    expect(dao.update).toHaveBeenCalledWith("s1", { code: "y" });
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createCodeSnippetsService(dao as never);
    await svc.delete("s1");
    expect(dao.delete).toHaveBeenCalledWith("s1");
  });

  it("deleteByBestPracticeId delegates to dao", async () => {
    const dao = makeMockDao();
    const svc = createCodeSnippetsService(dao as never);
    await svc.deleteByBestPracticeId("bp1");
    expect(dao.deleteByBestPracticeId).toHaveBeenCalledWith("bp1");
  });
});
