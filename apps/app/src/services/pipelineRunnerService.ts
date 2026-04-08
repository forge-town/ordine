/**
 * Pipeline execution engine.
 *
 * Traverses pipeline nodes in topological order and executes each one,
 * passing results between nodes. Supports three executor types:
 *   - script  → runs a shell/python/js command via child_process
 *   - prompt  → sends input to an AI model via @ai-sdk/openai
 *   - skill   → looks up skill metadata and delegates to an AI model
 *
 * Progress is tracked through a Job record in the DB.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { ResultAsync, ok } from "neverthrow";
import type {
  PipelineNode,
  PipelineEdge,
  GitHubProjectNodeData,
} from "@/models/types/pipelineGraph";
import { type OperationEntity, operationsDao } from "@/models/daos/operationsDao";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { jobsDao } from "@/models/daos/jobsDao";
import { skillsDao } from "@/models/daos/skillsDao";
import type { ExecutorConfig } from "@/pages/OperationDetailPage/types";

const execAsync = promisify(exec);

// ─── types ────────────────────────────────────────────────────────────────────

interface NodeData {
  nodeType?: string;
  folderPath?: string;
  filePath?: string;
  localPath?: string;
  operationId?: string;
}

interface OperationConfig {
  executor?: ExecutorConfig;
}

// ─── error types ──────────────────────────────────────────────────────────────

class PipelineNotFoundError extends Error {
  constructor(public readonly pipelineId: string) {
    super(`Pipeline ${pipelineId} not found`);
    this.name = "PipelineNotFoundError";
  }
}

class ScriptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ScriptExecutionError";
  }
}

class PromptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PromptExecutionError";
  }
}

class ConfigParseError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly cause?: unknown
  ) {
    super(`Could not parse config for operation ${operationName}`);
    this.name = "ConfigParseError";
  }
}

class SkillExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SkillExecutionError";
  }
}

class GitCloneError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "GitCloneError";
  }
}

type PipelineRunError =
  | PipelineNotFoundError
  | ScriptExecutionError
  | PromptExecutionError
  | ConfigParseError
  | SkillExecutionError
  | GitCloneError;

// ─── topological sort ─────────────────────────────────────────────────────────

const topoSort = (nodes: PipelineNode[], edges: PipelineEdge[]): PipelineNode[] => {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }

  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: PipelineNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.find((n) => n.id === id);
    if (node) order.push(node);
    for (const neighbour of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbour) ?? 1) - 1;
      inDegree.set(neighbour, newDeg);
      if (newDeg === 0) queue.push(neighbour);
    }
  }

  return order;
};

// ─── executor helpers ─────────────────────────────────────────────────────────

const safeParseJson = (
  raw: string,
  operationName: string
): ResultAsync<OperationConfig, ConfigParseError> =>
  ResultAsync.fromPromise(
    Promise.resolve(JSON.parse(raw) as OperationConfig),
    (cause) => new ConfigParseError(operationName, cause)
  );

const safeReadInputFile = (
  path: string
): ResultAsync<{ content: string; isFile: boolean }, never> =>
  ResultAsync.fromPromise(
    (async () => {
      const stat = statSync(path);
      if (stat.isFile()) {
        const content = await readFile(path, "utf8");
        return { content, isFile: true };
      }
      return { content: path, isFile: false };
    })(),
    () => ({ content: path, isFile: false })
  ).orElse((fallback) => ok(fallback));

const runScript = (
  executor: ExecutorConfig,
  inputPath: string,
  inputContent: string
): ResultAsync<string, ScriptExecutionError> => {
  const lang = executor.language ?? "bash";
  const command = executor.command ?? "";
  if (!command.trim()) {
    return ResultAsync.fromSafePromise<string, ScriptExecutionError>(
      Promise.reject(new ScriptExecutionError("Script command is empty"))
    );
  }

  const env = {
    ...process.env,
    INPUT_PATH: inputPath,
    INPUT_CONTENT: inputContent,
  };

  const buildCmd = (): string => {
    if (lang === "python") return `python3 -c ${JSON.stringify(command)}`;
    if (lang === "javascript") return `node -e ${JSON.stringify(command)}`;
    if (lang === "bash") return command;
    throw new ScriptExecutionError(`Unknown script language: ${lang}`);
  };

  return ResultAsync.fromPromise(
    (async () => {
      const cmd = buildCmd();
      const { stdout } = await execAsync(cmd, { env, timeout: 60_000 });
      return stdout;
    })(),
    (cause) =>
      new ScriptExecutionError(
        `Script execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause
      )
  );
};

const runPrompt = (
  executor: ExecutorConfig,
  inputContent: string
): ResultAsync<string, PromptExecutionError> => {
  const prompt = executor.prompt;
  if (!prompt?.trim()) {
    return ResultAsync.fromSafePromise<string, PromptExecutionError>(
      Promise.reject(new PromptExecutionError("Prompt text is empty"))
    );
  }

  return ResultAsync.fromPromise(
    generateText({
      model: openai("gpt-4o-mini"),
      prompt: `${prompt}\n\nInput:\n${inputContent}`,
    }).then(({ text }) => text),
    (cause) =>
      new PromptExecutionError(
        `Prompt execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause
      )
  );
};

// ─── github clone helper ──────────────────────────────────────────────────────

const cloneGitHubRepo = (
  owner: string,
  repo: string,
  branch: string,
  githubToken?: string
): ResultAsync<string, GitCloneError> => {
  const cloneDir = join(tmpdir(), `ordine-pipeline-${Date.now()}-${repo}`);
  const url = githubToken
    ? `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;

  return ResultAsync.fromPromise(
    (async () => {
      await mkdir(cloneDir, { recursive: true });
      await execAsync(`git clone --depth 1 --branch ${branch} ${url} ${cloneDir}`, {
        timeout: 120_000,
      });
      return cloneDir;
    })(),
    (cause) =>
      new GitCloneError(
        `Failed to clone ${owner}/${repo}@${branch}: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause
      )
  );
};

const listDirTree = async (dir: string, prefix = "", depth = 0): Promise<string> => {
  if (depth > 3) return `${prefix}...\n`;
  const entries = await readdir(dir, { withFileTypes: true });
  const filtered = entries.filter((e) => e.name !== ".git");
  const lines: string[] = [];
  for (const entry of filtered) {
    if (entry.isDirectory()) {
      lines.push(`${prefix}${entry.name}/`);
      lines.push(await listDirTree(join(dir, entry.name), `${prefix}  `, depth + 1));
    } else {
      lines.push(`${prefix}${entry.name}`);
    }
  }
  return lines.join("\n");
};

// ─── skill executor helper ────────────────────────────────────────────────────

const runSkill = (
  skillId: string,
  skillDescription: string,
  inputContent: string,
  inputPath: string
): ResultAsync<string, never> => {
  const systemPrompt = [
    `You are executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    "Analyze the provided input and produce a detailed report.",
    "Be thorough, specific, and actionable.",
  ].join("\n");

  const userPrompt = inputPath
    ? `Project path: ${inputPath}\n\nInput:\n${inputContent}`
    : `Input:\n${inputContent}`;

  const generateFallbackReport = (): string => {
    const lines = currentContentLines(inputContent);
    return [
      `# Skill Report: ${skillId}`,
      "",
      `**Description:** ${skillDescription}`,
      `**Input path:** ${inputPath || "(none)"}`,
      `**Input size:** ${inputContent.length} chars, ${lines} lines`,
      "",
      "## Status",
      "",
      "LLM analysis unavailable (OPENAI_API_KEY not configured).",
      "Skill executed in passthrough mode — input forwarded as-is.",
      "",
      "## Input Preview",
      "",
      "```",
      inputContent.slice(0, 2000),
      inputContent.length > 2000 ? `\n... (${inputContent.length - 2000} more chars)` : "",
      "```",
    ].join("\n");
  };

  return ResultAsync.fromPromise(
    generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userPrompt,
    }).then(({ text }) => text),
    () => null
  ).orElse(() => ok(generateFallbackReport()));
};

const currentContentLines = (content: string): number => (content ? content.split("\n").length : 0);

// ─── main runner ──────────────────────────────────────────────────────────────

const executePipeline = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
  githubToken?: string;
}): Promise<{ ok: true; summary: string } | { ok: false; error: PipelineRunError }> => {
  const { pipelineId, jobId, githubToken } = opts;
  let inputPath = opts.inputPath ?? "";
  const tempDirs: string[] = [];

  const log = async (line: string) => {
    await jobsDao.appendLog(jobId, `[${new Date().toISOString()}] ${line}`);
  };

  await jobsDao.updateStatus(jobId, "running", { startedAt: Date.now() });
  await log(`Starting pipeline ${pipelineId}`);

  // Load pipeline
  const pipeline = await pipelinesDao.findById(pipelineId);
  if (!pipeline) {
    return { ok: false, error: new PipelineNotFoundError(pipelineId) };
  }

  const nodes = pipeline.nodes as PipelineNode[];
  const edges = pipeline.edges as PipelineEdge[];
  const ordered = topoSort(nodes, edges);

  await log(`Pipeline "${pipeline.name}" loaded. Processing ${ordered.length} nodes.`);

  // Load all operations referenced in the pipeline
  const operationIds = ordered
    .filter((n) => n.type === "operation")
    .map((n) => (n.data as unknown as NodeData).operationId)
    .filter((id): id is string => id !== undefined && id !== null && id !== "");

  const operationsMap = new Map<string, OperationEntity>();
  for (const id of operationIds) {
    const op = await operationsDao.findById(id);
    if (op) operationsMap.set(id, op);
  }

  // Context accumulates output across nodes
  let currentContent = "";
  let outputLocalPath = "";

  // Resolve initial input if a path was given
  if (inputPath && existsSync(inputPath)) {
    const readResult = await safeReadInputFile(inputPath);
    if (readResult.isOk()) {
      const { content, isFile } = readResult.value;
      currentContent = content;
      if (isFile) {
        await log(`Read input file: ${inputPath} (${content.length} chars)`);
      }
    }
  }

  // Walk nodes
  for (const node of ordered) {
    const data = node.data as unknown as NodeData;
    await log(
      `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`
    );

    // ── Input nodes ──────────────────────────────────────────────────────
    if (node.type === "folder") {
      const p = data.folderPath ?? "";
      if (p) {
        inputPath = p;
        currentContent = p;
        await log(`Input folder: ${p}`);
      }
      continue;
    }

    if (node.type === "code-file") {
      const p = data.filePath ?? "";
      if (p && existsSync(p)) {
        inputPath = p;
        currentContent = await readFile(p, "utf8");
        await log(`Read code file: ${p} (${currentContent.length} chars)`);
      }
      continue;
    }

    // ── GitHub Project nodes ─────────────────────────────────────────────
    if (node.type === "github-project") {
      const ghData = node.data as unknown as GitHubProjectNodeData;
      const owner = ghData.owner;
      const repo = ghData.repo;
      const branch = ghData.branch ?? "main";

      if (!owner || !repo) {
        await log(`WARNING: GitHub project node missing owner/repo, skipping`);
        continue;
      }

      await log(`Cloning GitHub repo ${owner}/${repo}@${branch}...`);
      const cloneResult = await cloneGitHubRepo(owner, repo, branch, githubToken);
      if (cloneResult.isErr()) {
        await log(`ERROR: ${cloneResult.error.message}`);
        return { ok: false, error: cloneResult.error };
      }

      const clonedDir = cloneResult.value;
      tempDirs.push(clonedDir);
      inputPath = clonedDir;
      const tree = await listDirTree(clonedDir);
      currentContent = `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}\n\nFile tree:\n${tree}`;
      await log(`Cloned to ${clonedDir} (tree: ${tree.split("\n").length} entries)`);
      continue;
    }

    // ── Output nodes ─────────────────────────────────────────────────────
    if (node.type === "output-local-path") {
      const rawPath = data.localPath ?? "";
      let resolvedPath = rawPath ? resolve(rawPath) : "";
      // If the path points to an existing directory, append a default filename
      if (resolvedPath && existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
        resolvedPath = join(resolvedPath, "output.md");
      }
      outputLocalPath = resolvedPath;
      await log(`Output path set: ${outputLocalPath}`);
      // Write the current content to the output path
      if (outputLocalPath && currentContent) {
        await mkdir(dirname(outputLocalPath), { recursive: true });
        await writeFile(outputLocalPath, currentContent, "utf8");
        await log(`Wrote output to: ${outputLocalPath} (${currentContent.length} chars)`);
      }
      continue;
    }

    // ── Operation nodes ──────────────────────────────────────────────────
    if (node.type === "operation") {
      const operationId = data.operationId ?? "";
      const operation = operationsMap.get(operationId);

      if (!operation) {
        await log(`WARNING: Operation ${operationId} not found, skipping`);
        continue;
      }

      const configResult = await safeParseJson(operation.config, operation.name);
      if (configResult.isErr()) {
        await log(`WARNING: ${configResult.error.message}, skipping`);
        continue;
      }

      const config = configResult.value;
      const executor = config.executor;
      if (!executor) {
        await log(`WARNING: No executor configured for operation "${operation.name}", skipping`);
        continue;
      }

      await log(`Executing operation "${operation.name}" (${executor.type})`);

      if (executor.type === "script") {
        const scriptResult = await runScript(executor, inputPath, currentContent);
        if (scriptResult.isErr()) {
          return { ok: false, error: scriptResult.error };
        }
        currentContent = scriptResult.value;
        await log(`Script output (${currentContent.length} chars)`);
      } else if (executor.type === "prompt") {
        const promptResult = await runPrompt(executor, currentContent);
        if (promptResult.isErr()) {
          return { ok: false, error: promptResult.error };
        }
        currentContent = promptResult.value;
        await log(`Prompt output (${currentContent.length} chars)`);
      } else if (executor.type === "skill") {
        const skillId = executor.skillId ?? "";
        if (!skillId) {
          await log(`WARNING: No skillId configured for operation "${operation.name}", skipping`);
          continue;
        }

        const skill = (await skillsDao.findById(skillId)) ?? (await skillsDao.findByName(skillId));
        const skillDescription = skill
          ? `${skill.label}: ${skill.description}`
          : `Skill "${skillId}" (no description available)`;

        await log(`Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`);
        const skillResult = await runSkill(skillId, skillDescription, currentContent, inputPath);
        currentContent = skillResult.isOk() ? skillResult.value : "";
        await log(`Skill output (${currentContent.length} chars)`);
      }

      continue;
    }

    // Skip other node types (github-project, condition, output-project-path)
    await log(`Skipped node type: ${node.type}`);
  }

  const summary = outputLocalPath
    ? `Output written to ${outputLocalPath}`
    : `Completed (no output-local-path node configured)`;

  await log(`Pipeline complete. ${summary}`);

  // Cleanup temp directories
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  return { ok: true, summary };
};

export const runPipeline = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
  githubToken?: string;
}): Promise<void> => {
  const result = await ResultAsync.fromPromise(
    executePipeline(opts),
    (cause) =>
      new ScriptExecutionError(
        cause instanceof Error ? cause.message : String(cause),
        cause
      ) as PipelineRunError
  );

  const outcome = result.isOk() ? result.value : { ok: false as const, error: result.error };

  if (outcome.ok) {
    await jobsDao.updateStatus(opts.jobId, "done", {
      finishedAt: Date.now(),
      result: { summary: outcome.summary },
    });
  } else {
    const message = outcome.error.message;
    await jobsDao.appendLog(opts.jobId, `[${new Date().toISOString()}] ERROR: ${message}`);
    await jobsDao.updateStatus(opts.jobId, "failed", {
      finishedAt: Date.now(),
      error: message,
    });
  }
};
