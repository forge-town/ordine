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

import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { ResultAsync, ok } from "neverthrow";
import type {
  PipelineNode,
  PipelineEdge,
  GitHubProjectNodeData,
  OutputMode,
} from "@/models/types/pipelineGraph";
import {
  type OperationEntity,
  operationsDao,
} from "@/models/daos/operationsDao";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { jobsDao } from "@/models/daos/jobsDao";
import { skillsDao } from "@/models/daos/skillsDao";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";
import type { ExecutorConfig } from "@/pages/OperationDetailPage/types";

const execAsync = promisify(exec);

// ─── LLM provider ────────────────────────────────────────────────────────────

import { settingsDao } from "@/models/daos/settingsDao";
import type { LlmProvider } from "@/models/tables/settings_table";

const PROVIDER_BASE_URLS: Record<string, string> = {
  kimi: "https://api.kimi.com/coding/v1",
  deepseek: "https://api.deepseek.com/v1",
};

interface LlmOverride {
  llmProvider?: LlmProvider;
  llmModel?: string;
}

const getLlmModel = async (override?: LlmOverride) => {
  const settings = await settingsDao.get();
  const provider = override?.llmProvider ?? settings.llmProvider;
  const model = override?.llmModel ?? settings.llmModel;
  const apiKey = settings.llmApiKey;

  if (!apiKey) return null;

  const baseURL = PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.kimi;

  const openai = createOpenAI({
    apiKey,
    baseURL,
    compatibility: "compatible",
    headers: { "User-Agent": "claude-code/1.0" },
  });
  return openai(model);
};

// ─── types ────────────────────────────────────────────────────────────────────

interface NodeData {
  nodeType?: string;
  folderPath?: string;
  filePath?: string;
  localPath?: string;
  operationId?: string;
  outputFileName?: string;
  outputMode?: OutputMode;
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
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScriptExecutionError";
  }
}

class PromptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PromptExecutionError";
  }
}

class ConfigParseError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly cause?: unknown,
  ) {
    super(`Could not parse config for operation ${operationName}`);
    this.name = "ConfigParseError";
  }
}

class SkillExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SkillExecutionError";
  }
}

class GitCloneError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
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

const topoSort = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
): PipelineNode[] => {
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
  operationName: string,
): ResultAsync<OperationConfig, ConfigParseError> =>
  ResultAsync.fromPromise(
    Promise.resolve(JSON.parse(raw) as OperationConfig),
    (cause) => new ConfigParseError(operationName, cause),
  );

const safeReadInputFile = (
  path: string,
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
    () => ({ content: path, isFile: false }),
  ).orElse((fallback) => ok(fallback));

const runScript = (
  executor: ExecutorConfig,
  inputPath: string,
  inputContent: string,
): ResultAsync<string, ScriptExecutionError> => {
  const lang = executor.language ?? "bash";
  const command = executor.command ?? "";
  if (!command.trim()) {
    return ResultAsync.fromSafePromise<string, ScriptExecutionError>(
      Promise.reject(new ScriptExecutionError("Script command is empty")),
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
        cause,
      ),
  );
};

type StreamCallback = (accumulated: string) => Promise<void>;

const runPrompt = (
  executor: ExecutorConfig,
  inputContent: string,
  override?: LlmOverride,
  onChunk?: StreamCallback,
): ResultAsync<string, PromptExecutionError> => {
  const prompt = executor.prompt;
  if (!prompt?.trim()) {
    return ResultAsync.fromSafePromise<string, PromptExecutionError>(
      Promise.reject(new PromptExecutionError("Prompt text is empty")),
    );
  }

  return ResultAsync.fromPromise(
    (async () => {
      const model = await getLlmModel(override);
      if (!model) {
        throw new PromptExecutionError(
          "LLM not configured (API key missing in settings)",
        );
      }
      const result = streamText({
        model,
        prompt: `${prompt}\n\nInput:\n${inputContent}`,
      });
      let accumulated = "";
      for await (const chunk of result.textStream) {
        accumulated += chunk;
        if (onChunk) await onChunk(accumulated);
      }
      return accumulated;
    })(),
    (cause) =>
      cause instanceof PromptExecutionError
        ? cause
        : new PromptExecutionError(
            `Prompt execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          ),
  );
};

// ─── github clone helper ──────────────────────────────────────────────────────

const cloneGitHubRepo = (
  owner: string,
  repo: string,
  branch: string,
  githubToken?: string,
): ResultAsync<string, GitCloneError> => {
  const cloneDir = join(tmpdir(), `ordine-pipeline-${Date.now()}-${repo}`);
  const url = githubToken
    ? `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;

  return ResultAsync.fromPromise(
    (async () => {
      await mkdir(cloneDir, { recursive: true });
      execSync(`git clone --depth 1 --branch ${branch} ${url} ${cloneDir}`, {
        timeout: 120_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      return cloneDir;
    })(),
    (cause) =>
      new GitCloneError(
        `Failed to clone ${owner}/${repo}@${branch}: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
  );
};

const listDirTree = async (
  dir: string,
  prefix = "",
  depth = 0,
): Promise<string> => {
  if (depth > 3) return `${prefix}...\n`;
  const entries = await readdir(dir, { withFileTypes: true });
  const filtered = entries.filter((e) => e.name !== ".git");
  const lines: string[] = [];
  for (const entry of filtered) {
    if (entry.isDirectory()) {
      lines.push(`${prefix}${entry.name}/`);
      lines.push(
        await listDirTree(join(dir, entry.name), `${prefix}  `, depth + 1),
      );
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
  inputPath: string,
  override?: LlmOverride,
  onChunk?: StreamCallback,
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
      "LLM analysis unavailable (LLM_API_KEY not configured).",
      "Skill executed in passthrough mode — input forwarded as-is.",
      "",
      "## Input Preview",
      "",
      "```",
      inputContent.slice(0, 2000),
      inputContent.length > 2000
        ? `\n... (${inputContent.length - 2000} more chars)`
        : "",
      "```",
    ].join("\n");
  };

  return ResultAsync.fromPromise(
    (async () => {
      const model = await getLlmModel(override);
      if (!model) return generateFallbackReport();
      const result = streamText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
      });
      let accumulated = "";
      for await (const chunk of result.textStream) {
        accumulated += chunk;
        if (onChunk) await onChunk(accumulated);
      }
      return accumulated;
    })(),
    (cause) => cause,
  ).orElse((cause) => {
    console.error("[runSkill] LLM call failed:", cause);
    return ok(generateFallbackReport());
  });
};

const currentContentLines = (content: string): number =>
  content ? content.split("\n").length : 0;

// ─── main runner ──────────────────────────────────────────────────────────────

const executePipeline = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
  githubToken?: string;
}): Promise<
  { ok: true; summary: string } | { ok: false; error: PipelineRunError }
> => {
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

  await log(
    `Pipeline "${pipeline.name}" loaded. Processing ${ordered.length} nodes.`,
  );

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
      `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`,
    );
    await log(`@@NODE_START::${node.id}`);

    // ── Input nodes ──────────────────────────────────────────────────────
    if (node.type === "folder") {
      const p = data.folderPath ?? "";
      if (p && existsSync(p)) {
        inputPath = p;
        const tree = await listDirTree(p);
        currentContent = `Folder: ${p}\n\nFile tree:\n${tree}`;
        await log(
          `Input folder: ${p} (tree: ${tree.split("\n").length} entries)`,
        );
      }
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    if (node.type === "code-file") {
      const p = data.filePath ?? "";
      if (p && existsSync(p)) {
        inputPath = p;
        currentContent = await readFile(p, "utf8");
        await log(`Read code file: ${p} (${currentContent.length} chars)`);
      }
      await log(`@@NODE_DONE::${node.id}`);
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
        await log(`@@NODE_FAIL::${node.id}`);
        continue;
      }

      await log(`Cloning GitHub repo ${owner}/${repo}@${branch}...`);
      const cloneResult = await cloneGitHubRepo(
        owner,
        repo,
        branch,
        githubToken,
      );
      if (cloneResult.isErr()) {
        await log(`ERROR: ${cloneResult.error.message}`);
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: cloneResult.error };
      }

      const clonedDir = cloneResult.value;
      tempDirs.push(clonedDir);
      inputPath = clonedDir;
      const tree = await listDirTree(clonedDir);
      currentContent = `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}\n\nFile tree:\n${tree}`;
      await log(
        `Cloned to ${clonedDir} (tree: ${tree.split("\n").length} entries)`,
      );
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // ── Output nodes ─────────────────────────────────────────────────────
    if (node.type === "output-local-path") {
      const rawPath = data.localPath ?? "";
      const outputFileName = data.outputFileName?.trim() || "output.md";
      const outputMode: OutputMode = data.outputMode ?? "overwrite";
      let resolvedPath = rawPath ? resolve(rawPath) : "";
      // If the path points to an existing directory, append the filename
      if (
        resolvedPath &&
        existsSync(resolvedPath) &&
        statSync(resolvedPath).isDirectory()
      ) {
        resolvedPath = join(resolvedPath, outputFileName);
      }

      // Handle output mode
      if (resolvedPath && existsSync(resolvedPath)) {
        if (outputMode === "error_if_exists") {
          await log(
            `ERROR: Output file already exists: ${resolvedPath} (mode: error_if_exists)`,
          );
          await log(`@@NODE_FAIL::${node.id}`);
          return {
            ok: false,
            error: new ScriptExecutionError(
              `Output file already exists: ${resolvedPath}. Pipeline aborted (output mode: error_if_exists).`,
            ),
          };
        }
        if (outputMode === "auto_rename") {
          const dir = dirname(resolvedPath);
          const ext = extname(resolvedPath);
          const base = basename(resolvedPath, ext);
          let counter = 1;
          let candidate = resolvedPath;
          while (existsSync(candidate)) {
            candidate = join(dir, `${base}_${counter}${ext}`);
            counter++;
          }
          resolvedPath = candidate;
          await log(`Auto-renamed to avoid conflict: ${resolvedPath}`);
        }
        // "overwrite" mode — no special handling, just overwrites below
      }

      outputLocalPath = resolvedPath;
      await log(`Output path set: ${outputLocalPath} (mode: ${outputMode})`);
      // Write the current content to the output path
      if (outputLocalPath && currentContent) {
        await mkdir(dirname(outputLocalPath), { recursive: true });
        await writeFile(outputLocalPath, currentContent, "utf8");
        await log(
          `Wrote output to: ${outputLocalPath} (${currentContent.length} chars)`,
        );
      }
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // ── Operation nodes ──────────────────────────────────────────────────
    if (node.type === "operation") {
      const operationId = data.operationId ?? "";
      const operation = operationsMap.get(operationId);

      if (!operation) {
        await log(`WARNING: Operation ${operationId} not found, skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        continue;
      }

      // Per-node LLM override (from canvas node data)
      const opData = node.data as unknown as {
        llmProvider?: LlmProvider;
        llmModel?: string;
        bestPracticeId?: string;
      };
      const llmOverride: LlmOverride | undefined =
        opData.llmProvider || opData.llmModel
          ? { llmProvider: opData.llmProvider, llmModel: opData.llmModel }
          : undefined;

      // Load best practice content if a bestPracticeId is attached to this node
      let bestPracticeContent = "";
      if (opData.bestPracticeId) {
        const bp = await bestPracticesDao.findById(opData.bestPracticeId);
        if (bp) {
          bestPracticeContent = bp.content;
          await log(
            `Loaded best practice "${bp.title}" (${bp.content.length} chars)`,
          );
        } else {
          await log(
            `WARNING: Best practice ${opData.bestPracticeId} not found, continuing without standards`,
          );
        }
      }

      if (!operation) {
        await log(`WARNING: Operation ${operationId} not found, skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        continue;
      }

      const configResult = await safeParseJson(
        operation.config,
        operation.name,
      );
      if (configResult.isErr()) {
        await log(`WARNING: ${configResult.error.message}, skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        continue;
      }

      const config = configResult.value;
      const executor = config.executor;
      if (!executor) {
        await log(
          `WARNING: No executor configured for operation "${operation.name}", skipping`,
        );
        await log(`@@NODE_FAIL::${node.id}`);
        continue;
      }

      // Backward compat: normalize legacy "skill"/"prompt" types to "agent"
      const rawType = executor.type as string;
      if (rawType === "skill" || rawType === "prompt") {
        executor.agentMode = rawType as "skill" | "prompt";
        executor.type = "agent";
      }

      await log(`Executing operation "${operation.name}" (${executor.type})`);

      // Throttled streaming callback — emit partial LLM content every 2 seconds
      let lastChunkTime = 0;
      const CHUNK_THROTTLE_MS = 2000;
      const handleChunk = async (accumulated: string) => {
        const now = Date.now();
        if (now - lastChunkTime >= CHUNK_THROTTLE_MS) {
          lastChunkTime = now;
          await log(`@@LLM_CONTENT::${node.id}::${accumulated}`);
        }
      };

      // Build effective input: prepend best practice standards when available
      const effectiveInput = bestPracticeContent
        ? `## Standards (Best Practice)\n\n${bestPracticeContent}\n\n---\n\n${currentContent}`
        : currentContent;

      if (executor.type === "script") {
        const scriptResult = await runScript(
          executor,
          inputPath,
          currentContent,
        );
        if (scriptResult.isErr()) {
          await log(`@@NODE_FAIL::${node.id}`);
          return { ok: false, error: scriptResult.error };
        }
        currentContent = scriptResult.value;
        await log(`Script output (${currentContent.length} chars)`);
      } else if (executor.type === "agent" && executor.agentMode === "prompt") {
        const promptResult = await runPrompt(
          executor,
          effectiveInput,
          llmOverride,
          handleChunk,
        );
        if (promptResult.isErr()) {
          await log(`@@NODE_FAIL::${node.id}`);
          return { ok: false, error: promptResult.error };
        }
        currentContent = promptResult.value;
        await log(`@@LLM_CONTENT::${node.id}::${currentContent}`);
        await log(`Prompt output (${currentContent.length} chars)`);
      } else if (executor.type === "agent" && executor.agentMode === "skill") {
        const skillId = executor.skillId ?? "";
        if (!skillId) {
          await log(
            `WARNING: No skillId configured for operation "${operation.name}", skipping`,
          );
          await log(`@@NODE_FAIL::${node.id}`);
          continue;
        }

        const skill =
          (await skillsDao.findById(skillId)) ??
          (await skillsDao.findByName(skillId));
        const skillDescription = skill
          ? `${skill.label}: ${skill.description}`
          : `Skill "${skillId}" (no description available)`;

        await log(
          `Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`,
        );
        const skillResult = await runSkill(
          skillId,
          skillDescription,
          effectiveInput,
          inputPath,
          llmOverride,
          handleChunk,
        );
        currentContent = skillResult.isOk() ? skillResult.value : "";
        await log(`@@LLM_CONTENT::${node.id}::${currentContent}`);
        await log(`Skill output (${currentContent.length} chars)`);
      }

      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // Skip other node types (github-project, condition, output-project-path)
    await log(`Skipped node type: ${node.type}`);
    await log(`@@NODE_DONE::${node.id}`);
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
        cause,
      ) as PipelineRunError,
  );

  const outcome = result.isOk()
    ? result.value
    : { ok: false as const, error: result.error };

  if (outcome.ok) {
    await jobsDao.updateStatus(opts.jobId, "done", {
      finishedAt: Date.now(),
      result: { summary: outcome.summary },
    });
  } else {
    const message = outcome.error.message;
    await jobsDao.appendLog(
      opts.jobId,
      `[${new Date().toISOString()}] ERROR: ${message}`,
    );
    await jobsDao.updateStatus(opts.jobId, "failed", {
      finishedAt: Date.now(),
      error: message,
    });
  }
};
