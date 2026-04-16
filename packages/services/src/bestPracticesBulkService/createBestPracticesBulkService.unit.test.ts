import { describe, it, expect, vi } from "vitest";

const mockBpDao = {
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

const mockChecklistItemsDao = {
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

const mockCodeSnippetsDao = {
  findByBestPracticeId: vi
    .fn()
    .mockResolvedValue([{ id: "s1", title: "Snippet", language: "ts", code: "x", sortOrder: 0 }]),
};

const txBpDao = {
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "bp1" }),
  update: vi.fn().mockResolvedValue({ id: "bp1" }),
};

const txChecklistDao = {
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "ci1" }),
  update: vi.fn().mockResolvedValue({ id: "ci1" }),
};

const txSnippetsDao = {
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "s1" }),
  update: vi.fn().mockResolvedValue({ id: "s1" }),
};

let callCount = 0;
vi.mock("@repo/models", () => ({
  createBestPracticesDao: (executor: unknown) => {
    if (executor === "tx") return txBpDao;
    return mockBpDao;
  },
  createChecklistItemsDao: (executor: unknown) => {
    if (executor === "tx") return txChecklistDao;
    return mockChecklistItemsDao;
  },
  createCodeSnippetsDao: (executor: unknown) => {
    if (executor === "tx") return txSnippetsDao;
    return mockCodeSnippetsDao;
  },
}));

import {
  createBestPracticesBulkService,
  type BulkImportEntry,
} from "./createBestPracticesBulkService";

const mockDb = {
  transaction: vi.fn().mockImplementation(async (fn: (tx: string) => Promise<unknown>) => fn("tx")),
};

describe("createBestPracticesBulkService", () => {
  describe("exportAll", () => {
    it("returns all best practices with checklist items and code snippets", async () => {
      const svc = createBestPracticesBulkService(mockDb as never);
      const result = await svc.exportAll();

      expect(mockBpDao.findMany).toHaveBeenCalled();
      expect(mockChecklistItemsDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
      expect(mockCodeSnippetsDao.findByBestPracticeId).toHaveBeenCalledWith("bp1");
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
      txBpDao.findById.mockResolvedValue(null);
      txChecklistDao.findById.mockResolvedValue(null);
      txSnippetsDao.findById.mockResolvedValue(null);

      const svc = createBestPracticesBulkService(mockDb as never);
      const counts = await svc.importBulk([entry]);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(txBpDao.create).toHaveBeenCalled();
      expect(txChecklistDao.create).toHaveBeenCalled();
      expect(txSnippetsDao.create).toHaveBeenCalled();
      expect(counts).toEqual({ imported: 1, checklistItems: 1, codeSnippets: 1 });
    });

    it("updates existing records", async () => {
      txBpDao.findById.mockResolvedValue({ id: "bp1" });
      txChecklistDao.findById.mockResolvedValue({ id: "ci1" });
      txSnippetsDao.findById.mockResolvedValue({ id: "s1" });

      const svc = createBestPracticesBulkService(mockDb as never);
      const counts = await svc.importBulk([entry]);

      expect(txBpDao.update).toHaveBeenCalled();
      expect(txChecklistDao.update).toHaveBeenCalled();
      expect(txSnippetsDao.update).toHaveBeenCalled();
      expect(counts).toEqual({ imported: 1, checklistItems: 1, codeSnippets: 1 });
    });
  });
});
