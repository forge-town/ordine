import { apiGet, apiPut } from "../api";

interface BestPractice {
  id: string;
  title: string;
  language: string;
  codeSnippet: string;
}

interface CodeSnippet {
  id: string;
  bestPracticeId: string;
  title: string;
  language: string;
  code: string;
  sortOrder: number;
}

const migrate = async () => {
  console.log("🔄 Migrating codeSnippet → code_snippets table...\n");

  const bestPractices = await apiGet<BestPractice[]>("/api/best-practices");
  console.log(`Found ${bestPractices.length} best practices.\n`);

  const counts = { migrated: 0, skipped: 0 };

  for (const bp of bestPractices) {
    if (!bp.codeSnippet.trim()) {
      counts.skipped++;
      continue;
    }

    const existing = await apiGet<CodeSnippet[]>(`/api/code-snippets?bestPracticeId=${bp.id}`);
    if (existing.length > 0) {
      console.log(`  ⏭  ${bp.id} — already has ${existing.length} snippet(s), skipping`);
      counts.skipped++;
      continue;
    }

    await apiPut("/api/code-snippets", {
      id: `cs_${bp.id}_main`,
      bestPracticeId: bp.id,
      title: bp.title,
      language: bp.language,
      code: bp.codeSnippet,
      sortOrder: 0,
    });

    console.log(`  ✅  ${bp.id} — migrated`);
    counts.migrated++;
  }

  console.log(`\n🎉 Done — ${counts.migrated} migrated, ${counts.skipped} skipped.`);
};

migrate().catch((error: unknown) => {
  console.error("❌ Migration failed:", error);
  throw error instanceof Error ? error : new Error(String(error));
});
