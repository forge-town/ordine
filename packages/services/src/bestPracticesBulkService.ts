import type {
  BestPracticesDaoInstance,
  ChecklistItemEntity,
  ChecklistItemsDaoInstance,
  CodeSnippetEntity,
  CodeSnippetsDaoInstance,
} from "@repo/models";
import type { BestPracticeRow } from "@repo/db-schema";

type DaoFactory<D, Tx> = {
  (executor: Tx): D;
};

type BpDaoWithFind = {
  findById(id: string): Promise<BestPracticeRow | null>;
};

type BpService = {
  getAll(): Promise<BestPracticeRow[]>;
};

type ChecklistItemService = {
  getItemsByBestPracticeId(bestPracticeId: string): Promise<ChecklistItemEntity[]>;
};

type CodeSnippetsService = {
  getByBestPracticeId(bestPracticeId: string): Promise<CodeSnippetEntity[]>;
};

type TransactionRunner<Tx> = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;

export interface BulkImportEntry {
  id: string;
  title: string;
  condition: string;
  content: string;
  category: string;
  language: string;
  codeSnippet: string;
  tags: string[];
  checklistItems: Array<{
    id: string;
    title: string;
    description: string;
    checkType: "script" | "llm";
    script: string | null;
    sortOrder: number;
  }>;
  codeSnippets: Array<{
    id: string;
    title: string;
    language: string;
    code: string;
    sortOrder: number;
  }>;
}

export const createBestPracticesBulkService = <Tx>(deps: {
  bpDao: BpDaoWithFind;
  bpDaoFactory: DaoFactory<BestPracticesDaoInstance, Tx>;
  checklistDao: ChecklistItemsDaoInstance;
  checklistDaoFactory: DaoFactory<ChecklistItemsDaoInstance, Tx>;
  snippetsDao: CodeSnippetsDaoInstance;
  snippetsDaoFactory: DaoFactory<CodeSnippetsDaoInstance, Tx>;
  bpService: BpService;
  checklistService: ChecklistItemService;
  codeSnippetsService: CodeSnippetsService;
  runTransaction: TransactionRunner<Tx>;
}) => ({
  exportAll: async () => {
    const practices = await deps.bpService.getAll();
    return Promise.all(
      practices.map(async (bp) => {
        const [checklistItems, codeSnippets] = await Promise.all([
          deps.checklistService.getItemsByBestPracticeId(bp.id),
          deps.codeSnippetsService.getByBestPracticeId(bp.id),
        ]);
        return {
          ...bp,
          checklistItems: checklistItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            checkType: item.checkType,
            script: item.script,
            sortOrder: item.sortOrder,
          })),
          codeSnippets: codeSnippets.map((s) => ({
            id: s.id,
            title: s.title,
            language: s.language,
            code: s.code,
            sortOrder: s.sortOrder,
          })),
        };
      }),
    );
  },

  importBulk: async (entries: BulkImportEntry[]) => {
    return deps.runTransaction(async (tx: Tx) => {
      const counts = { imported: 0, checklistItems: 0, codeSnippets: 0 };
      const txBpDao = deps.bpDaoFactory(tx);
      const txChecklistDao = deps.checklistDaoFactory(tx);
      const txSnippetsDao = deps.snippetsDaoFactory(tx);

      for (const entry of entries) {
        const { checklistItems, codeSnippets, ...bpData } = entry;

        const existing = await deps.bpDao.findById(bpData.id);
        if (existing) {
          const { id: _, ...patch } = bpData;
          await txBpDao.update(bpData.id, patch);
        } else {
          await txBpDao.create(bpData);
        }
        counts.imported++;

        for (const item of checklistItems) {
          const itemData = { ...item, bestPracticeId: bpData.id };
          const existingItem = await deps.checklistDao.findById(item.id);
          if (existingItem) {
            const { id: _id, bestPracticeId: _bpId, ...patch } = itemData;
            await txChecklistDao.update(item.id, patch);
          } else {
            await txChecklistDao.create(itemData);
          }
          counts.checklistItems++;
        }

        for (const snippet of codeSnippets) {
          const snippetData = { ...snippet, bestPracticeId: bpData.id };
          const existingSnippet = await deps.snippetsDao.findById(snippet.id);
          if (existingSnippet) {
            const { id: _id, bestPracticeId: _bpId, ...patch } = snippetData;
            await txSnippetsDao.update(snippet.id, patch);
          } else {
            await txSnippetsDao.create(snippetData);
          }
          counts.codeSnippets++;
        }
      }

      return counts;
    });
  },
});
