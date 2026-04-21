import JSZip from "jszip";
import { trpcClient } from "@/integrations/trpc/client";

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

type BPData = {
  id: string;
  title: string;
  condition: string;
  content: string;
  category: string;
  language: string;
  codeSnippet: string;
  tags: string[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type ChecklistItem = {
  id: string;
  bestPracticeId: string;
  title: string;
  description: string | null;
  checkType: string;
  script: string | null;
  sortOrder: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type CodeSnippetItem = {
  id: string;
  title: string;
  language: string;
  code: string;
  sortOrder: number;
  bestPracticeId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const addBPToZip = (
  zip: JSZip,
  bp: BPData,
  items: ChecklistItem[],
  snippets: CodeSnippetItem[]
) => {
  const folder = zip.folder(bp.id);
  if (!folder) return;

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
      2
    )
  );

  folder.file("content.md", bp.content || "");

  // Write code snippets as JSON array
  if (snippets.length > 0) {
    folder.file("code-snippets.json", JSON.stringify(snippets, null, 2) + "\n");
  } else if (bp.codeSnippet) {
    // Fallback: write legacy single snippet file for backward compat
    const ext = LANG_EXT[bp.language] ?? "txt";
    folder.file(`code-snippet.${ext}`, bp.codeSnippet || "");
  }

  const checklistLines = items.map((item, idx) => {
    const parts = [`- [ ] ${idx + 1}. ${item.title}`];
    if (item.description) parts.push(`\n  ${item.description}`);
    if (item.checkType === "script" && item.script)
      parts.push(`\n  \`\`\`\n  ${item.script}\n  \`\`\``);

    return parts.join("");
  });
  folder.file("checklist.md", `# ${bp.title} 检查清单\n\n${checklistLines.join("\n\n")}\n`);

  const itemsData = items.map(({ bestPracticeId: _, ...rest }) => rest);
  folder.file("checklist-items.json", JSON.stringify(itemsData, null, 2) + "\n");
};

const downloadZip = async (zip: JSZip, filename: string) => {
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportSingleBestPractice = async (id: string, title: string) => {
  const [bp, items, snippets] = await Promise.all([
    trpcClient.bestPractices.getById.query({ id }),
    trpcClient.checklist.getItemsByBestPracticeId.query({ bestPracticeId: id }),
    trpcClient.codeSnippets.getByBestPracticeId.query({ bestPracticeId: id }),
  ]);

  if (!bp) return;

  const zip = new JSZip();
  addBPToZip(zip, bp as BPData, items as ChecklistItem[], snippets as CodeSnippetItem[]);
  await downloadZip(zip, `${title || id}.bestpractice`);
};

export const exportAllBestPractices = async () => {
  const base64 = await trpcClient.bestPractices.exportAsZip.query();
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.codePointAt(0) ?? 0);
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `best-practices-${new Date().toISOString().slice(0, 10)}.bestpractice`;
  a.click();
  URL.revokeObjectURL(url);
};

export type ParsedBestPractice = Record<string, unknown>;

export const parseBestPracticesZip = async (file: File): Promise<ParsedBestPractice[]> => {
  const zip = await JSZip.loadAsync(file);
  const folders = new Set<string>();

  zip.forEach((path) => {
    const parts = path.split("/");
    if (parts[0]) folders.add(parts[0]);
  });

  const bestPractices: Record<string, unknown>[] = [];

  for (const folderId of folders) {
    const metaFile = zip.file(`${folderId}/metadata.json`);
    if (!metaFile) continue;

    const metaText = await metaFile.async("string");
    const meta = JSON.parse(metaText) as Record<string, unknown>;

    const contentFile = zip.file(`${folderId}/content.md`);
    const content = contentFile ? await contentFile.async("string") : "";

    // Read code snippets: prefer code-snippets.json, then code-snippets/ folder, then legacy code-snippet.*
    const codeSnippets: Record<string, unknown>[] = await (async () => {
      const snippetsJsonFile = zip.file(`${folderId}/code-snippets.json`);
      if (snippetsJsonFile) {
        const jsonText = await snippetsJsonFile.async("string");
        const parsed = JSON.parse(jsonText) as Record<string, unknown>[];

        return parsed.map((item) => ({
          ...item,
          bestPracticeId: meta.id,
        }));
      }

      // New format: code-snippets/ folder with individual files
      const snippetFiles = zip.file(new RegExp(`^${folderId}/code-snippets/[^/]+$`));
      if (snippetFiles.length > 0) {
        const results: Record<string, unknown>[] = [];
        for (const [idx, sf] of snippetFiles.entries()) {
          const fileName = sf.name.split("/").pop() ?? "";
          const code = await sf.async("string");
          const extMatch = fileName.match(/\.([^.]+)$/);
          const ext = extMatch?.[1] ?? "txt";
          const langEntry = Object.entries(LANG_EXT).find(([, v]) => v === ext);
          const language = langEntry ? langEntry[0] : "typescript";
          const baseName = fileName.replace(/\.[^.]+$/, "");
          results.push({
            id: `cs_${meta.id as string}_${idx}`,
            bestPracticeId: meta.id,
            title: baseName,
            language,
            code,
            sortOrder: idx,
          });
        }

        return results;
      }

      // Legacy: single code-snippet.* file
      for (const ext of Object.values(LANG_EXT)) {
        const codeFile = zip.file(`${folderId}/code-snippet.${ext}`);
        if (codeFile) {
          const code = await codeFile.async("string");
          if (code.trim()) {
            return [
              {
                id: `cs_${meta.id as string}_main`,
                bestPracticeId: meta.id,
                title: meta.title ?? "",
                language: (meta.language as string) ?? "typescript",
                code,
                sortOrder: 0,
              },
            ];
          }
        }
      }

      return [];
    })();

    // Derive legacy codeSnippet field from the first snippet (if any)
    const codeSnippet = codeSnippets.length > 0 ? ((codeSnippets[0]!["code"] as string) ?? "") : "";

    const checklistItems: Record<string, unknown>[] = await (async () => {
      const checklistJsonFile = zip.file(`${folderId}/checklist-items.json`);
      if (!checklistJsonFile) return [];
      const jsonText = await checklistJsonFile.async("string");
      const parsed = JSON.parse(jsonText) as Record<string, unknown>[];

      return parsed.map((item) => ({
        ...item,
        bestPracticeId: meta.id,
      }));
    })();

    bestPractices.push({
      ...meta,
      content,
      codeSnippet,
      checklistItems,
      codeSnippets,
    });
  }

  return bestPractices;
};

export const previewBestPracticesImport = async (entries: ParsedBestPractice[]) => {
  return trpcClient.bestPractices.previewImport.mutate(
    entries as Parameters<typeof trpcClient.bestPractices.previewImport.mutate>[0]
  );
};

export const submitBestPracticesImport = async (
  entries: ParsedBestPractice[]
): Promise<{ imported: number; checklistItems: number; codeSnippets: number }> => {
  return trpcClient.bestPractices.importBulk.mutate(
    entries as Parameters<typeof trpcClient.bestPractices.importBulk.mutate>[0]
  );
};

export const importBestPracticesFromZip = async (
  file: File
): Promise<{ imported: number; checklistItems: number; codeSnippets: number }> => {
  const entries = await parseBestPracticesZip(file);

  return submitBestPracticesImport(entries);
};
