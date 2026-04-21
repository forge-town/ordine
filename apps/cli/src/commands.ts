import { api } from "./api";
import { readFileSync, writeFileSync } from "node:fs";

interface Pipeline {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface Job {
  id: string;
  title: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  logs: string[];
  result: { summary?: string; output?: string } | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

interface RunResponse {
  jobId: string;
}

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

const POLL_INTERVAL_MS = 3000;

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};

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

// ─── Pipelines ───────────────────────────────────────────────────────

export const listPipelines = async (): Promise<void> => {
  const pipelines = assertOk(await api.get<Pipeline[]>("/api/pipelines"), "list pipelines");

  if (pipelines.length === 0) {
    console.log("No pipelines found.");

    return;
  }

  console.log(`\n  Pipelines (${pipelines.length}):\n`);
  for (const p of pipelines) {
    const tags = p.tags.length > 0 ? ` [${p.tags.join(", ")}]` : "";
    console.log(`  ${p.id}  ${p.name}${tags}`);
    if (p.description) console.log(`    ${p.description}`);
  }
  console.log();
};

export const getPipeline = async (id: string): Promise<void> => {
  const pipeline = assertOk(await api.get<Pipeline>(`/api/pipelines/${id}`), "get pipeline");
  console.log(JSON.stringify(pipeline, null, 2));
};

export const createPipeline = async (jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  const pipeline = assertOk(await api.post<Pipeline>("/api/pipelines", body), "create pipeline");
  console.log(`Created pipeline: ${pipeline.id}`);
};

export const updatePipeline = async (id: string, jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  assertOk(await api.patch<Pipeline>(`/api/pipelines/${id}`, body), "update pipeline");
  console.log(`Updated pipeline: ${id}`);
};

export const deletePipeline = async (id: string): Promise<void> => {
  assertOk(await api.del(`/api/pipelines/${id}`), "delete pipeline");
  console.log(`Deleted pipeline: ${id}`);
};

export const runPipeline = async (
  pipelineId: string,
  options: { inputPath?: string; follow?: boolean },
): Promise<void> => {
  console.log(`Triggering pipeline ${pipelineId}...`);

  const { jobId } = assertOk(
    await api.post<RunResponse>(`/api/pipelines/${pipelineId}/run`, {
      inputPath: options.inputPath,
    }),
    "run pipeline",
  );
  console.log(`Job created: ${jobId}`);

  if (options.follow === false) return;

  await pollJob(jobId);
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

// ─── Operations ──────────────────────────────────────────────────────

export const listOperations = async (): Promise<void> => {
  const ops = assertOk(await api.get<IdRecord[]>("/api/operations"), "list operations");

  if (ops.length === 0) {
    console.log("No operations found.");

    return;
  }

  console.log(`\n  Operations (${ops.length}):\n`);
  for (const o of ops) {
    printRecord(o);
  }
  console.log();
};

export const getOperation = async (id: string): Promise<void> => {
  const op = assertOk(await api.get<IdRecord>(`/api/operations/${id}`), "get operation");
  console.log(JSON.stringify(op, null, 2));
};

export const createOperation = async (jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  const op = assertOk(await api.post<IdRecord>("/api/operations", body), "create operation");
  console.log(`Created operation: ${op.id}`);
};

export const updateOperation = async (id: string, jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  assertOk(await api.patch<IdRecord>(`/api/operations/${id}`, body), "update operation");
  console.log(`Updated operation: ${id}`);
};

export const deleteOperation = async (id: string): Promise<void> => {
  assertOk(await api.del(`/api/operations/${id}`), "delete operation");
  console.log(`Deleted operation: ${id}`);
};

// ─── Jobs ────────────────────────────────────────────────────────────

export const listJobs = async (options: { status?: string }): Promise<void> => {
  const query = options.status ? `?status=${options.status}` : "";
  const jobs = assertOk(await api.get<Job[]>(`/api/jobs${query}`), "list jobs");

  if (jobs.length === 0) {
    console.log("No jobs found.");

    return;
  }

  console.log(`\n  Jobs (${jobs.length}):\n`);
  for (const j of jobs) {
    console.log(`  ${j.id}  ${j.status}  ${j.title ?? ""}`);
  }
  console.log();
};

export const getJob = async (id: string): Promise<void> => {
  const job = assertOk(await api.get<Job>(`/api/jobs/${id}`), "get job");
  console.log(JSON.stringify(job, null, 2));
};

export const deleteJob = async (id: string): Promise<void> => {
  assertOk(await api.del(`/api/jobs/${id}`), "delete job");
  console.log(`Deleted job: ${id}`);
};

// ─── Recipes ─────────────────────────────────────────────────────────

export const listRecipes = async (): Promise<void> => {
  const recipes = assertOk(await api.get<IdRecord[]>("/api/recipes"), "list recipes");

  if (recipes.length === 0) {
    console.log("No recipes found.");

    return;
  }

  console.log(`\n  Recipes (${recipes.length}):\n`);
  for (const r of recipes) {
    printRecord(r);
  }
  console.log();
};

export const createRecipe = async (jsonPath: string): Promise<void> => {
  const body = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  const recipe = assertOk(await api.post<IdRecord>("/api/recipes", body), "create recipe");
  console.log(`Created recipe: ${recipe.id}`);
};

export const deleteRecipe = async (id: string): Promise<void> => {
  assertOk(await api.del(`/api/recipes/${id}`), "delete recipe");
  console.log(`Deleted recipe: ${id}`);
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
  const res = await fetch(
    `${process.env["ORDINE_API_URL"] ?? "http://localhost:9433"}/api/best-practices/export`,
  );
  if (!res.ok) throw new CliError(`Failed to export: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buffer);
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

const pollJob = async (jobId: string): Promise<void> => {
  const startTime = Date.now();
  const seenLogCount = { value: 0 };

  const poll = async (): Promise<void> => {
    const result = await api.get<Job>(`/api/jobs/${jobId}`);

    if (!result.ok) {
      throw new CliError(`Failed to fetch job: ${result.message}`);
    }

    const job = result.data;

    // Print new log lines
    const newLogs = job.logs.slice(seenLogCount.value);
    for (const line of newLogs) {
      console.log(line);
    }
    seenLogCount.value = job.logs.length;

    if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
      const elapsed = formatDuration(Date.now() - startTime);
      console.log();

      if (job.status === "done") {
        console.log(`Pipeline completed in ${elapsed}`);
        if (job.result?.summary) {
          console.log(`  Summary: ${job.result.summary}`);
        }
      } else if (job.status === "failed") {
        console.error(`Pipeline failed after ${elapsed}`);
        if (job.error) console.error(`  Error: ${job.error}`);
        throw new CliError("Pipeline failed");
      } else {
        console.log(`Pipeline cancelled after ${elapsed}`);
      }

      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    return poll();
  };

  await poll();
};
