import type {
  BestPracticesDaoInstance,
  ChecklistItemsDaoInstance,
  CodeSnippetsDaoInstance,
} from "@repo/models";

type DaoFactory<D, Tx> = (executor: Tx) => D;
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
  bpDao: BestPracticesDaoInstance;
  bpDaoFactory: DaoFactory<BestPracticesDaoInstance, Tx>;
  checklistItemsDao: ChecklistItemsDaoInstance;
  checklistDaoFactory: DaoFactory<ChecklistItemsDaoInstance, Tx>;
  codeSnippetsDao: CodeSnippetsDaoInstance;
  snippetsDaoFactory: DaoFactory<CodeSnippetsDaoInstance, Tx>;
  runTransaction: TransactionRunner<Tx>;
}) => ({
  exportAll: async () => {
    const practices = await deps.bpDao.findMany();
    return Promise.all(
      practices.map(async (bp) => {
        const [checklistItems, codeSnippets] = await Promise.all([
          deps.checklistItemsDao.findByBestPracticeId(bp.id),
          deps.codeSnippetsDao.findByBestPracticeId(bp.id),
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

        const existing = await txBpDao.findById(bpData.id);
        if (existing) {
          const { id: _, ...patch } = bpData;
          await txBpDao.update(bpData.id, patch);
        } else {
          await txBpDao.create(bpData);
        }
        counts.imported++;

        for (const item of checklistItems) {
          const itemData = { ...item, bestPracticeId: bpData.id };
          const existingItem = await txChecklistDao.findById(item.id);
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
          const existingSnippet = await txSnippetsDao.findById(snippet.id);
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
