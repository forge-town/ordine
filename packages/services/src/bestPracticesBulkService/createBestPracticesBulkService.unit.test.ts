import { describe, it, expect, vi } from "vitest";
import {
  createBestPracticesBulkService,
  type BulkImportEntry,
} from "./createBestPracticesBulkService";

const makeDeps = () => {
  const bpDao = {
    findMany: vi.fn().mockResolvedValue([
      {
        id: "bp1",
        title: "BP1",
        condition: "",
        content: "",
        category: "",
        language: "",
        codeSnippet: "",
        tags: [],
      },
    ]),
    findById: vi.fn().mockResolvedValue(null),
  };
  const txBpDao = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "bp1" }),
    update: vi.fn().mockResolvedValue({ id: "bp1" }),
  };
  const checklistItemsDao = {
    findByBestPracticeId: vi.fn().mockResolvedValue([
      {
        id: "ci1",
        title: "Check",
        description: "desc",
        checkType: "llm",
        script: null,
        sortOrder: 0,
      },
    ]),
  };
  const txChecklistDao = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "ci1" }),
    update: vi.fn().mockResolvedValue({ id: "ci1" }),
  };
  const codeSnippetsDao = {
    findByBestPracticeId: vi
      .fn()
      .mockResolvedValue([{ id: "s1", title: "Snippet", language: "ts", code: "x", sortOrder: 0 }]),
  };
  const txSnippetsDao = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "s1" }),
    update: vi.fn().mockResolvedValue({ id: "s1" }),
  };
  const runTransaction = vi
    .fn()
    .mockImplementation(async (fn: (tx: string) => Promise<unknown>) => fn("tx"));

  return {
    bpDao,
    bpDaoFactory: vi.fn().mockReturnValue(txBpDao),
    checklistItemsDao,
    checklistDaoFactory: vi.fn().mockReturnValue(txChecklistDao),
    codeSnippetsDao,
    snippetsDaoFactory: vi.fn().mockReturnValue(txSnippetsDao),
    runTransaction,
    _txBpDao: txBpDao,
    _txChecklistDao: txChecklistDao,
    _txSnippetsDao: txSnippetsDao,
  };
};

describe("createBestPracticesBulkService", () => {
  describe("exportAll", () => {
    it("returns all best practices with checklist items and code snippets", async () => {
      const deps = makeDeps();
      const svc = createBestPracticesBulkService(deps as never);
      const result = await svc.exportAll();

      expect(deps.bpDao.findMany).toHaveBeenCalled();
      expect(deps.checklistItemsDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
      expect(deps.codeSnippetsDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
      expect(result).toHaveLength(1);
      expect(result[0]!.checklistItems).toHaveLength(1);
      expect(result[0]!.codeSnippets).toHaveLength(1);
    });
  });

  describe("importBulk", () => {
    const entry: BulkImportEntry = {
      id: "bp1",
      title: "BP1",
      condition: "cond",
      content: "content",
      category: "cat",
      language: "ts",
      codeSnippet: "",
      tags: ["tag1"],
      checklistItems: [
        {
          id: "ci1",
          title: "Check",
          description: "desc",
          checkType: "llm",
          script: null,
          sortOrder: 0,
        },
      ],
      codeSnippets: [{ id: "s1", title: "Snippet", language: "ts", code: "x", sortOrder: 0 }],
    };

    it("creates new records when they do not exist", async () => {
      const deps = makeDeps();
      const svc = createBestPracticesBulkService(deps as never);
      const counts = await svc.importBulk([entry]);

      expect(deps.runTransaction).toHaveBeenCalled();
      expect(deps._txBpDao.create).toHaveBeenCalled();
      expect(deps._txChecklistDao.create).toHaveBeenCalled();
      expect(deps._txSnippetsDao.create).toHaveBeenCalled();
      expect(counts).toEqual({ imported: 1, checklistItems: 1, codeSnippets: 1 });
    });

    it("updates existing records", async () => {
      const deps = makeDeps();
      deps._txBpDao.findById.mockResolvedValue({ id: "bp1" });
      deps._txChecklistDao.findById.mockResolvedValue({ id: "ci1" });
      deps._txSnippetsDao.findById.mockResolvedValue({ id: "s1" });

      const svc = createBestPracticesBulkService(deps as never);
      const counts = await svc.importBulk([entry]);

      expect(deps._txBpDao.update).toHaveBeenCalled();
      expect(deps._txChecklistDao.update).toHaveBeenCalled();
      expect(deps._txSnippetsDao.update).toHaveBeenCalled();
      expect(counts).toEqual({ imported: 1, checklistItems: 1, codeSnippets: 1 });
    });
  });
});
