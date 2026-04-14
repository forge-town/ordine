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

type BPData = {
  id: string;
  title: string;
  condition: string;
  content: string;
  category: string;
  language: string;
  codeSnippet: string;
  tags: string[];
};

type ChecklistItem = {
  id: string;
  bestPracticeId: string;
  title: string;
  description: string | null;
  checkType: string;
  script: string | null;
  sortOrder: number;
};

type CodeSnippetItem = {
  id: string;
  title: string;
  language: string;
  code: string;
  sortOrder: number;
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
    const snippetsData = snippets.map(({ ...rest }) => rest);
    folder.file("code-snippets.json", JSON.stringify(snippetsData, null, 2) + "\n");
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
  const [bpResp, itemsResp, snippetsResp] = await Promise.all([
    fetch(`/api/best-practices/${id}`),
    fetch(`/api/checklist-items?bestPracticeId=${id}`),
    fetch(`/api/code-snippets?bestPracticeId=${id}`),
  ]);

  const bp = (await bpResp.json()) as BPData;
  const items = (await itemsResp.json()) as ChecklistItem[];
  const snippets = (await snippetsResp.json()) as CodeSnippetItem[];

  const zip = new JSZip();
  addBPToZip(zip, bp, items, snippets);
  await downloadZip(zip, `${title || id}.bestpractice`);
};

export const exportAllBestPractices = async () => {
  const resp = await fetch("/api/best-practices/export");
  const data = (await resp.json()) as (BPData & {
    checklistItems: ChecklistItem[];
    codeSnippets: CodeSnippetItem[];
  })[];

  const zip = new JSZip();
  for (const { checklistItems, codeSnippets, ...bp } of data) {
    addBPToZip(zip, bp, checklistItems, codeSnippets);
  }
  await downloadZip(zip, `best-practices-${new Date().toISOString().slice(0, 10)}.bestpractice`);
};

export const importBestPracticesFromZip = async (
  file: File
): Promise<{ imported: number; checklistItems: number; codeSnippets: number }> => {
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

    // Read code snippets: prefer new code-snippets.json, fallback to legacy code-snippet.*
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

    // Still read legacy codeSnippet for backward compat with the BP schema
    const codeSnippet = await (async () => {
      for (const ext of Object.values(LANG_EXT)) {
        const codeFile = zip.file(`${folderId}/code-snippet.${ext}`);
        if (codeFile) return await codeFile.async("string");
      }
      return "";
    })();

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

  const resp = await fetch("/api/best-practices/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bestPractices),
  });

  return (await resp.json()) as { imported: number; checklistItems: number; codeSnippets: number };
};
