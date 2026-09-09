import { api } from "./api";
import { readFileSync, writeFileSync } from "node:fs";

interface IdRecord {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
}

interface DirEntry {
  name: string;
  type: string;
}

class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "CliError";
  }
}

const printRecord = (record: IdRecord): void => {
  const label = record.name ?? record.title ?? record.id;
  console.log(`  ${record.id}  ${label}`);
  if (record.description) console.log(`    ${record.description}`);
};

const assertOk = <T>(result: { ok: boolean; data?: T; message?: string }, action: string): T => {
  if (!result.ok) {
    throw new CliError(`Failed to ${action}: ${result.message}`);
  }

  return (result as { ok: true; data: T }).data;
};

// ─── Rules ───────────────────────────────────────────────────────────

export const listRules = async (): Promise<void> => {
  const rules = assertOk(await api.get<IdRecord[]>("/api/rules"), "list rules");

  if (rules.length === 0) {
    console.log("No rules found.");

    return;
  }

  console.log(`\n  Rules (${rules.length}):\n`);
  for (const r of rules) {
    printRecord(r);
  }
  console.log();
};

export const getRule = async (id: string): Promise<void> => {
  const rule = assertOk(await api.get<IdRecord>(`/api/rules/${id}`), "get rule");
  console.log(JSON.stringify(rule, null, 2));
};

export const createRule = async (jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  const rule = assertOk(await api.post<IdRecord>("/api/rules", body), "create rule");
  console.log(`Created rule: ${rule.id}`);
};

export const updateRule = async (id: string, jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  assertOk(await api.patch<IdRecord>(`/api/rules/${id}`, body), "update rule");
  console.log(`Updated rule: ${id}`);
};

export const deleteRule = async (id: string): Promise<void> => {
  assertOk(await api.del(`/api/rules/${id}`), "delete rule");
  console.log(`Deleted rule: ${id}`);
};

// ─── Skills ──────────────────────────────────────────────────────────

export const listSkills = async (): Promise<void> => {
  const skills = assertOk(await api.get<IdRecord[]>("/api/skills"), "list skills");

  if (skills.length === 0) {
    console.log("No skills found.");

    return;
  }

  console.log(`\n  Skills (${skills.length}):\n`);
  for (const s of skills) {
    printRecord(s);
  }
  console.log();
};

export const getSkill = async (id: string): Promise<void> => {
  const skill = assertOk(await api.get<IdRecord>(`/api/skills/${id}`), "get skill");
  console.log(JSON.stringify(skill, null, 2));
};

export const createSkill = async (jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  const skill = assertOk(await api.post<IdRecord>("/api/skills", body), "create skill");
  console.log(`Created skill: ${skill.id}`);
};

export const updateSkill = async (id: string, jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  assertOk(await api.patch<IdRecord>(`/api/skills/${id}`, body), "update skill");
  console.log(`Updated skill: ${id}`);
};

export const deleteSkill = async (id: string): Promise<void> => {
  assertOk(await api.del(`/api/skills/${id}`), "delete skill");
  console.log(`Deleted skill: ${id}`);
};

// ─── Best Practices ──────────────────────────────────────────────────

export const listBestPractices = async (): Promise<void> => {
  const bps = assertOk(await api.get<IdRecord[]>("/api/best-practices"), "list best practices");

  if (bps.length === 0) {
    console.log("No best practices found.");

    return;
  }

  console.log(`\n  Best Practices (${bps.length}):\n`);
  for (const b of bps) {
    printRecord(b);
  }
  console.log();
};

export const getBestPractice = async (id: string): Promise<void> => {
  const bp = assertOk(await api.get<IdRecord>(`/api/best-practices/${id}`), "get best practice");
  console.log(JSON.stringify(bp, null, 2));
};

export const createBestPractice = async (jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  const bp = assertOk(
    await api.post<IdRecord>("/api/best-practices", body),
    "create best practice",
  );
  console.log(`Created best practice: ${bp.id}`);
};

export const updateBestPractice = async (id: string, jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  assertOk(await api.patch<IdRecord>(`/api/best-practices/${id}`, body), "update best practice");
  console.log(`Updated best practice: ${id}`);
};

export const deleteBestPractice = async (id: string): Promise<void> => {
  assertOk(await api.del(`/api/best-practices/${id}`), "delete best practice");
  console.log(`Deleted best practice: ${id}`);
};

export const exportBestPractices = async (outPath: string): Promise<void> => {
  const data = assertOk(await api.getBytes("/api/best-practices/export"), "export best practices");
  writeFileSync(outPath, data);
  console.log(`Exported best practices to: ${outPath}`);
};

export const importBestPractices = async (jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  const result = assertOk(
    await api.post<{ imported: number; checklistItems: number; codeSnippets: number }>(
      "/api/best-practices/import",
      body,
    ),
    "import best practices",
  );
  console.log(
    `Imported: ${result.imported} best practices, ${result.checklistItems} checklist items, ${result.codeSnippets} code snippets`,
  );
};

// ─── Filesystem ──────────────────────────────────────────────────────

export const browseFilesystem = async (dirPath?: string): Promise<void> => {
  const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
  const entries = assertOk(
    await api.get<DirEntry[]>(`/api/filesystem/browse${query}`),
    "browse filesystem",
  );

  if (entries.length === 0) {
    console.log("Empty directory.");

    return;
  }

  for (const e of entries) {
    const suffix = e.type === "directory" ? "/" : "";
    console.log(`  ${e.name}${suffix}`);
  }
};
