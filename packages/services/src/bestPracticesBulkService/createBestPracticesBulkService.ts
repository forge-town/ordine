import {
  createBestPracticesDao,
  createChecklistItemsDao,
  createCodeSnippetsDao,
  type DbConnection,
} from "@repo/models";
import type { BestPracticeImportEntry } from "@repo/schemas";
import JSZip from "jszip";

const LANG_EXT: Record<string, string> = {
  typescript: "ts",
  tsx: "tsx",
  javascript: "js",
  python: "py",
  sql: "sql",
  bash: "sh",
  json: "json",
  yaml: "yaml",
  markdown: "md",
};

export const createBestPracticesBulkService = (db: DbConnection) => {
  const bpDao = createBestPracticesDao(db);
  const checklistItemsDao = createChecklistItemsDao(db);
  const codeSnippetsDao = createCodeSnippetsDao(db);

  return {
    previewImport: async (entries: BestPracticeImportEntry[]) => {
      const items: Array<{
        id: string;
        title: string;
        status: "new" | "update";
        checklistItemCount: number;
        codeSnippetCount: number;
      }> = [];

      for (const entry of entries) {
        const existing = await bpDao.findById(entry.id);
        items.push({
          id: entry.id,
          title: entry.title,
          status: existing ? "update" : "new",
          checklistItemCount: entry.checklistItems.length,
          codeSnippetCount: entry.codeSnippets.length,
        });
      }

      return {
        total: items.length,
        newCount: items.filter((i) => i.status === "new").length,
        updateCount: items.filter((i) => i.status === "update").length,
        items,
      };
    },

    exportAll: async () => {
      const practices = await bpDao.findMany();

      return Promise.all(
        practices.map(async (bp) => {
          const [checklistItems, codeSnippets] = await Promise.all([
            checklistItemsDao.findByBestPracticeId(bp.id),
            codeSnippetsDao.findByBestPracticeId(bp.id),
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

    importBulk: async (entries: BestPracticeImportEntry[]) => {
      return db.transaction(async (tx) => {
        const counts = { imported: 0, checklistItems: 0, codeSnippets: 0 };
        const txBpDao = createBestPracticesDao(tx);
        const txChecklistDao = createChecklistItemsDao(tx);
        const txSnippetsDao = createCodeSnippetsDao(tx);

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

    exportAsZip: async (): Promise<Uint8Array> => {
      const practices = await bpDao.findMany();
      const zip = new JSZip();

      for (const bp of practices) {
        const [checklistItems, codeSnippets] = await Promise.all([
          checklistItemsDao.findByBestPracticeId(bp.id),
          codeSnippetsDao.findByBestPracticeId(bp.id),
        ]);

        const folder = zip.folder(bp.id);
        if (!folder) continue;

        folder.file(
          "metadata.json",
          JSON.stringify(
            {
              id: bp.id,
              title: bp.title,
              condition: bp.condition,
              category: bp.category,
              language: bp.language,
              tags: bp.tags,
            },
            null,
            2,
          ),
        );

        folder.file("content.md", bp.content || "");

        if (codeSnippets.length > 0) {
          const snippetsFolder = folder.folder("code-snippets");
          if (snippetsFolder) {
            for (const s of codeSnippets) {
              const ext = LANG_EXT[s.language] ?? "txt";
              const shortTitle = s.title?.split(/\s*[—–-]\s*/)[0]?.trim();
              const baseName = shortTitle
                ? shortTitle.replace(/\.[^.]+$/, "").replaceAll(/[/\\:*?"<>|]/g, "_")
                : `snippet-${s.sortOrder}`;
              snippetsFolder.file(`${baseName}.${ext}`, s.code);
            }
          }
        } else if (bp.codeSnippet) {
          const ext = LANG_EXT[bp.language] ?? "txt";
          folder.file(`code-snippet.${ext}`, bp.codeSnippet || "");
        }

        const checklistLines = checklistItems.map((item, idx) => {
          const parts = [`- [ ] ${idx + 1}. ${item.title}`];
          if (item.description) parts.push(`\n  ${item.description}`);
          if (item.checkType === "script" && item.script)
            parts.push(`\n  \`\`\`\n  ${item.script}\n  \`\`\``);

          return parts.join("");
        });
        folder.file("checklist.md", `# ${bp.title} 检查清单\n\n${checklistLines.join("\n\n")}\n`);

        const itemsData = checklistItems.map(({ bestPracticeId: _, ...rest }) => rest);
        folder.file("checklist-items.json", JSON.stringify(itemsData, null, 2) + "\n");
      }

      return zip.generateAsync({ type: "uint8array" });
    },
  };
};
