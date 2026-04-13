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

const addBPToZip = (zip: JSZip, bp: BPData, items: ChecklistItem[]) => {
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
      2,
    ),
  );

  folder.file("content.md", bp.content || "");

  const ext = LANG_EXT[bp.language] ?? "txt";
  folder.file(`code-snippet.${ext}`, bp.codeSnippet || "");

  const checklistLines = items.map((item, idx) => {
    let line = `- [ ] ${idx + 1}. ${item.title}`;
    if (item.description) line += `\n  ${item.description}`;
    if (item.checkType === "script" && item.script)
      line += `\n  \`\`\`\n  ${item.script}\n  \`\`\``;
    return line;
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
  const [bpResp, itemsResp] = await Promise.all([
    fetch(`/api/best-practices/${id}`),
    fetch(`/api/checklist-items?bestPracticeId=${id}`),
  ]);

  const bp = (await bpResp.json()) as BPData;
  const items = (await itemsResp.json()) as ChecklistItem[];

  const zip = new JSZip();
  addBPToZip(zip, bp, items);
  await downloadZip(zip, `${title || id}.bestpractice`);
};

export const exportAllBestPractices = async () => {
  const resp = await fetch("/api/best-practices/export");
  const data = (await resp.json()) as (BPData & { checklistItems: ChecklistItem[] })[];

  const zip = new JSZip();
  for (const { checklistItems, ...bp } of data) {
    addBPToZip(zip, bp, checklistItems);
  }
  await downloadZip(zip, `best-practices-${new Date().toISOString().slice(0, 10)}.bestpractice`);
};

export const importBestPracticesFromZip = async (
  file: File,
): Promise<{ imported: number; checklistItems: number }> => {
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

    let codeSnippet = "";
    for (const ext of Object.values(LANG_EXT)) {
      const codeFile = zip.file(`${folderId}/code-snippet.${ext}`);
      if (codeFile) {
        codeSnippet = await codeFile.async("string");
        break;
      }
    }

    const checklistJsonFile = zip.file(`${folderId}/checklist-items.json`);
    let checklistItems: Record<string, unknown>[] = [];
    if (checklistJsonFile) {
      const jsonText = await checklistJsonFile.async("string");
      const parsed = JSON.parse(jsonText) as Record<string, unknown>[];
      checklistItems = parsed.map((item) => ({
        ...item,
        bestPracticeId: meta.id,
      }));
    }

    bestPractices.push({
      ...meta,
      content,
      codeSnippet,
      checklistItems,
    });
  }

  const resp = await fetch("/api/best-practices/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bestPractices),
  });

  return (await resp.json()) as { imported: number; checklistItems: number };
};
