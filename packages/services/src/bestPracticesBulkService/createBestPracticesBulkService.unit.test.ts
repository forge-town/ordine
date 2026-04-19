import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";

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
      bestPracticeId: "bp1",
    },
  ]),
};

const mockCodeSnippetsDao = {
  findByBestPracticeId: vi
    .fn()
    .mockResolvedValue([
      { id: "s1", title: "Snippet", language: "typescript", code: "x", sortOrder: 0 },
    ]),
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
  describe("previewImport", () => {
    it("returns new status for non-existing best practices", async () => {
      mockBpDao.findById.mockResolvedValue(null);
      const svc = createBestPracticesBulkService(mockDb as never);
      const result = await svc.previewImport([
        {
          id: "bp_new",
          title: "New BP",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
          checklistItems: [
            {
              id: "ci1",
              title: "Check",
              description: "",
              checkType: "llm" as const,
              script: null,
              sortOrder: 0,
            },
          ],
          codeSnippets: [],
        },
      ]);

      expect(result.total).toBe(1);
      expect(result.newCount).toBe(1);
      expect(result.updateCount).toBe(0);
      expect(result.items[0]!.status).toBe("new");
      expect(result.items[0]!.checklistItemCount).toBe(1);
    });

    it("returns update status for existing best practices", async () => {
      mockBpDao.findById.mockResolvedValue({ id: "bp_existing" });
      const svc = createBestPracticesBulkService(mockDb as never);
      const result = await svc.previewImport([
        {
          id: "bp_existing",
          title: "Existing BP",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
          checklistItems: [],
          codeSnippets: [
            { id: "s1", title: "Snippet", language: "typescript", code: "x", sortOrder: 0 },
          ],
        },
      ]);

      expect(result.total).toBe(1);
      expect(result.newCount).toBe(0);
      expect(result.updateCount).toBe(1);
      expect(result.items[0]!.status).toBe("update");
      expect(result.items[0]!.codeSnippetCount).toBe(1);
    });

    it("handles mixed new and existing entries", async () => {
      mockBpDao.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "bp2" });
      const svc = createBestPracticesBulkService(mockDb as never);
      const result = await svc.previewImport([
        {
          id: "bp1",
          title: "New",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
          checklistItems: [],
          codeSnippets: [],
        },
        {
          id: "bp2",
          title: "Existing",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
          checklistItems: [],
          codeSnippets: [],
        },
      ]);

      expect(result.total).toBe(2);
      expect(result.newCount).toBe(1);
      expect(result.updateCount).toBe(1);
    });
  });

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

  describe("exportAsZip", () => {
    it("returns a valid ZIP with correct folder structure", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp_test",
          title: "Test BP",
          condition: "cond",
          content: "# Hello",
          category: "cat",
          language: "typescript",
          codeSnippet: "",
          tags: ["a"],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([
        { id: "s1", title: "myHelper", language: "typescript", code: "const x = 1;", sortOrder: 0 },
      ]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([
        {
          id: "ci1",
          title: "Check item",
          description: "",
          checkType: "llm",
          script: null,
          sortOrder: 0,
          bestPracticeId: "bp_test",
        },
      ]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();

      expect(zipData).toBeInstanceOf(Uint8Array);
      expect(zipData.length).toBeGreaterThan(0);

      const zip = await JSZip.loadAsync(zipData);
      expect(zip.file("bp_test/metadata.json")).not.toBeNull();
      expect(zip.file("bp_test/content.md")).not.toBeNull();
      expect(zip.file("bp_test/code-snippets/myHelper.ts")).not.toBeNull();
      expect(zip.file("bp_test/checklist.md")).not.toBeNull();
      expect(zip.file("bp_test/checklist-items.json")).not.toBeNull();
    });

    it("generates correct metadata.json content", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp_meta",
          title: "Meta Test",
          condition: "when testing",
          content: "",
          category: "testing",
          language: "typescript",
          codeSnippet: "",
          tags: ["unit", "test"],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);
      const metaText = await zip.file("bp_meta/metadata.json")!.async("string");
      const meta = JSON.parse(metaText);

      expect(meta).toEqual({
        id: "bp_meta",
        title: "Meta Test",
        condition: "when testing",
        category: "testing",
        language: "typescript",
        tags: ["unit", "test"],
      });
    });

    it("strips Chinese description from snippet filename (dash separator)", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp1",
          title: "BP",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([
        {
          id: "s1",
          title: "authService.ts — 基础 DAO + Zod 验证",
          language: "typescript",
          code: "code",
          sortOrder: 0,
        },
      ]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);

      expect(zip.file("bp1/code-snippets/authService.ts")).not.toBeNull();
      const content = await zip.file("bp1/code-snippets/authService.ts")!.async("string");
      expect(content).toBe("code");
    });

    it("strips Chinese description with en-dash separator", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp1",
          title: "BP",
          condition: "",
          content: "",
          category: "",
          language: "python",
          codeSnippet: "",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([
        { id: "s1", title: "helper.py – 辅助函数", language: "python", code: "pass", sortOrder: 0 },
      ]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);

      expect(zip.file("bp1/code-snippets/helper.py")).not.toBeNull();
    });

    it("uses snippet-{sortOrder} when title is empty", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp1",
          title: "BP",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([
        { id: "s1", title: "", language: "typescript", code: "code", sortOrder: 3 },
      ]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);

      expect(zip.file("bp1/code-snippets/snippet-3.ts")).not.toBeNull();
    });

    it("falls back to code-snippet file when no code snippets array", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp1",
          title: "BP",
          condition: "",
          content: "",
          category: "",
          language: "python",
          codeSnippet: "print('hi')",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);

      expect(zip.file("bp1/code-snippet.py")).not.toBeNull();
      const content = await zip.file("bp1/code-snippet.py")!.async("string");
      expect(content).toBe("print('hi')");
    });

    it("uses txt extension for unknown language", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp1",
          title: "BP",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([
        { id: "s1", title: "config", language: "toml", code: "[section]", sortOrder: 0 },
      ]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);

      expect(zip.file("bp1/code-snippets/config.txt")).not.toBeNull();
    });

    it("generates checklist.md with correct format", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp1",
          title: "My Practice",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([
        {
          id: "ci1",
          title: "First check",
          description: "details",
          checkType: "llm",
          script: null,
          sortOrder: 0,
          bestPracticeId: "bp1",
        },
        {
          id: "ci2",
          title: "Script check",
          description: "",
          checkType: "script",
          script: "echo ok",
          sortOrder: 1,
          bestPracticeId: "bp1",
        },
      ]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);
      const checklist = await zip.file("bp1/checklist.md")!.async("string");

      expect(checklist).toContain("# My Practice 检查清单");
      expect(checklist).toContain("- [ ] 1. First check");
      expect(checklist).toContain("details");
      expect(checklist).toContain("- [ ] 2. Script check");
      expect(checklist).toContain("echo ok");
    });

    it("replaces invalid filesystem characters in snippet filename", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp1",
          title: "BP",
          condition: "",
          content: "",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([
        { id: "s1", title: "my:file*name?", language: "typescript", code: "code", sortOrder: 0 },
      ]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);

      expect(zip.file("bp1/code-snippets/my_file_name_.ts")).not.toBeNull();
    });

    it("handles multiple best practices in one ZIP", async () => {
      mockBpDao.findMany.mockResolvedValue([
        {
          id: "bp_a",
          title: "A",
          condition: "",
          content: "aaa",
          category: "",
          language: "typescript",
          codeSnippet: "",
          tags: [],
        },
        {
          id: "bp_b",
          title: "B",
          condition: "",
          content: "bbb",
          category: "",
          language: "python",
          codeSnippet: "",
          tags: [],
        },
      ]);
      mockCodeSnippetsDao.findByBestPracticeId.mockResolvedValue([]);
      mockChecklistItemsDao.findByBestPracticeId.mockResolvedValue([]);

      const svc = createBestPracticesBulkService(mockDb as never);
      const zipData = await svc.exportAsZip();
      const zip = await JSZip.loadAsync(zipData);

      expect(zip.file("bp_a/metadata.json")).not.toBeNull();
      expect(zip.file("bp_b/metadata.json")).not.toBeNull();

      const contentA = await zip.file("bp_a/content.md")!.async("string");
      const contentB = await zip.file("bp_b/content.md")!.async("string");
      expect(contentA).toBe("aaa");
      expect(contentB).toBe("bbb");
    });
  });
});
