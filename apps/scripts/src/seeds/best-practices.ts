import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { apiPut, apiDelete } from "../api";

const BP_DIR = resolve(import.meta.dirname ?? __dirname, "../best-practices");

interface Metadata {
  id: string;
  title: string;
  condition: string;
  category: string;
  language: string;
  tags: string[];
}

interface ChecklistItemSeed {
  id: string;
  bestPracticeId: string;
  title: string;
  description: string;
  checkType: "script" | "llm";
  sortOrder: number;
}

interface CodeSnippetSeed {
  id: string;
  bestPracticeId: string;
  title: string;
  language: string;
  code: string;
  sortOrder: number;
}

function readFolders(): string[] {
  return readdirSync(BP_DIR).filter((name) => {
    const full = join(BP_DIR, name);

    return statSync(full).isDirectory();
  });
}

function readMetadata(folder: string): Metadata {
  const raw = readFileSync(join(BP_DIR, folder, "metadata.json"), "utf8");

  return JSON.parse(raw) as Metadata;
}

function readContent(folder: string): string {
  const p = join(BP_DIR, folder, "content.md");

  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

function readCodeSnippet(folder: string): string {
  const dir = join(BP_DIR, folder);
  const files = readdirSync(dir);
  const codeFile = files.find((f) => f.startsWith("code-snippet."));
  if (!codeFile) return "";

  return readFileSync(join(dir, codeFile), "utf8").trim();
}

function readChecklistItems(folder: string, bpId: string): ChecklistItemSeed[] {
  const p = join(BP_DIR, folder, "checklist-items.json");
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const items = JSON.parse(raw) as Omit<ChecklistItemSeed, "bestPracticeId">[];

  return items.map((item) => ({ ...item, bestPracticeId: bpId }));
}

function readCodeSnippets(folder: string, bpId: string): CodeSnippetSeed[] {
  const p = join(BP_DIR, folder, "code-snippets.json");
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const items = JSON.parse(raw) as Omit<CodeSnippetSeed, "bestPracticeId">[];

  return items.map((item) => ({ ...item, bestPracticeId: bpId }));
}

async function seed() {
  console.log("🌱 Seeding best practices from folders...\n");
  console.log(`📁 Source: ${BP_DIR}\n`);

  const folders = readFolders();
  console.log(`Found ${folders.length} best practice folders.\n`);

  let bpCount = 0;
  let clCount = 0;
  let csCount = 0;

  for (const folder of folders) {
    const meta = readMetadata(folder);
    const content = readContent(folder);
    const codeSnippet = readCodeSnippet(folder);
    const checklistItems = readChecklistItems(folder, meta.id);
    const codeSnippets = readCodeSnippets(folder, meta.id);

    await apiPut("/api/best-practices", {
      ...meta,
      content,
      codeSnippet,
    });
    console.log(`  ✅  ${meta.id} — ${meta.title}`);
    bpCount++;

    for (const item of checklistItems) {
      await apiPut("/api/checklist-items", item);
      clCount++;
    }
    if (checklistItems.length > 0) {
      console.log(`      └─ ${checklistItems.length} checklist items`);
    }

    for (const snippet of codeSnippets) {
      await apiPut("/api/code-snippets", snippet);
      csCount++;
    }
    if (codeSnippets.length > 0) {
      console.log(`      └─ ${codeSnippets.length} code snippets`);
    }
  }

  const DUPLICATES = [
    "bp_useeffect",
    "bp_service_layer",
    "bp_dao_pattern",
    "bp_store_design",
    "bp_props_drilling",
  ];
  for (const id of DUPLICATES) {
    try {
      await apiDelete(`/api/best-practices/${id}`);
      console.log(`  🗑️  ${id} — deleted (duplicate)`);
    } catch {
      // ignore if not found
    }
  }

  console.log(
    `\n🎉 Done — ${bpCount} best practices, ${clCount} checklist items, ${csCount} code snippets upserted.`,
  );
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
