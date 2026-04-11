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
import { readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
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
import { listDirTree, readProjectFiles } from "@/services/filesystemService";

const execAsync = promisify(exec);

// ─── LLM provider ────────────────────────────────────────────────────────────

import { settingsDao } from "@/models/daos/settingsDao";
import type { LlmProvider } from "@/models/tables/settings_table";

const PROVIDER_BASE_URLS: Record<string, string> = {
  kimi: "https://api.kimi.com/coding/v1",
  deepseek: "https://api.deepseek.com/v1",
};

const PROVIDER_MASTRA_PREFIX: Record<string, string> = {
  kimi: "kimi-for-coding",
  deepseek: "deepseek",
};

interface LlmOverride {
  llmProvider?: LlmProvider;
  llmModel?: string;
}

type LogFn = (msg: string) => Promise<void>;
const noopLog: LogFn = async () => {};

const getLlmModel = async (override?: LlmOverride, log: LogFn = noopLog) => {
  const settings = await settingsDao.get();
  const provider = override?.llmProvider ?? settings.llmProvider;
  const model = override?.llmModel ?? settings.llmModel;
  const apiKey = settings.llmApiKey;

  await log(
    `[LLM] Provider: ${provider}, Model: ${model}, API key: ${apiKey ? `configured (${apiKey.slice(0, 6)}...)` : "NOT SET"}`,
  );

  if (!apiKey) {
    await log(
      `[LLM] WARNING: No API key configured — LLM calls will be skipped`,
    );
    return null;
  }

  const baseURL = PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.kimi;
  await log(`[LLM] Base URL: ${baseURL}`);

  const openai = createOpenAI({
    apiKey,
    baseURL,
    compatibility: "compatible",
    headers: { "User-Agent": "claude-code/1.0" },
  });
  return openai(model);
};

const getMastraModelConfig = async (
  override?: LlmOverride,
  log: LogFn = noopLog,
) => {
  const settings = await settingsDao.get();
  const provider = override?.llmProvider ?? settings.llmProvider;
  const model = override?.llmModel ?? settings.llmModel;
  const apiKey = settings.llmApiKey;

  if (!apiKey) {
    await log(`[Mastra] No API key configured — agent calls will be skipped`);
    return null;
  }

  const baseURL = PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.kimi;
  const prefix = PROVIDER_MASTRA_PREFIX[provider] ?? "kimi-for-coding";
  const modelId = `${prefix}/${model}` as const;
  await log(`[Mastra] Model: ${modelId}, URL: ${baseURL}`);

  return {
    id: modelId as `${string}/${string}`,
    url: baseURL,
    apiKey,
    headers: { "User-Agent": "claude-code/1.0" },
  };
};

// ─── types ────────────────────────────────────────────────────────────────────

interface NodeData {
  nodeType?: string;
  folderPath?: string;
  excludedPaths?: string[];
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
  log: LogFn = noopLog,
): ResultAsync<string, PromptExecutionError> => {
  const prompt = executor.prompt;
  if (!prompt?.trim()) {
    return ResultAsync.fromSafePromise<string, PromptExecutionError>(
      Promise.reject(new PromptExecutionError("Prompt text is empty")),
    );
  }

  return ResultAsync.fromPromise(
    (async () => {
      await log(
        `[LLM] runPrompt: prompt length=${prompt.length}, input length=${inputContent.length}`,
      );
      const model = await getLlmModel(override, log);
      if (!model) {
        await log(`[LLM] runPrompt: LLM not configured, throwing error`);
        throw new PromptExecutionError(
          "LLM not configured (API key missing in settings)",
        );
      }
      await log(`[LLM] runPrompt: Starting streamText...`);
      const result = streamText({
        model,
        prompt: `${prompt}\n\nInput:\n${inputContent}`,
      });
      let accumulated = "";
      for await (const chunk of result.textStream) {
        accumulated += chunk;
        if (onChunk) await onChunk(accumulated);
      }
      await log(
        `[LLM] runPrompt: Stream complete, total output=${accumulated.length} chars`,
      );
      return accumulated;
    })(),
    (cause) => {
      log(
        `[LLM] runPrompt: Error — ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      return cause instanceof PromptExecutionError
        ? cause
        : new PromptExecutionError(
            `Prompt execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          );
    },
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

// listDirTree is now imported from filesystemService

// ─── skill executor helper (Mastra Agent) ────────────────────────────────────

const buildSkillTools = (projectRoot: string) => {
  const MAX_READ_SIZE = 100_000;

  const readFileTool = createTool({
    id: "readFile",
    description:
      "Read the contents of a file. Use relative paths from the project root.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "Relative file path from the project root, e.g. 'src/components/Button.tsx'",
        ),
    }),
    execute: async ({ path: relPath }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      try {
        const content = await readFile(fullPath, "utf8");
        if (content.length > MAX_READ_SIZE) {
          return {
            content: content.slice(0, MAX_READ_SIZE),
            truncated: true,
            totalSize: content.length,
          };
        }
        return { content, truncated: false, totalSize: content.length };
      } catch {
        return { error: `File not found or unreadable: ${relPath}` };
      }
    },
  });

  const listDirectoryTool = createTool({
    id: "listDirectory",
    description:
      "List entries in a directory. Returns file and folder names with types.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "Relative directory path from project root, e.g. 'src/pages'",
        ),
    }),
    execute: async ({ path: relPath }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      try {
        const entries = await readdir(fullPath, { withFileTypes: true });
        return entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "directory" : "file",
        }));
      } catch {
        return { error: `Directory not found: ${relPath}` };
      }
    },
  });

  const searchCodeTool = createTool({
    id: "searchCode",
    description:
      "Search for a text pattern in files under a directory. Returns matching file paths and line content.",
    inputSchema: z.object({
      pattern: z.string().describe("Text or regex pattern to search for"),
      directory: z
        .string()
        .describe("Relative directory to search in, e.g. 'src/pages'"),
      fileExtensions: z
        .array(z.string())
        .optional()
        .describe("File extensions to include, e.g. ['.tsx', '.ts']"),
    }),
    execute: async ({ pattern, directory, fileExtensions }) => {
      const searchDir = join(projectRoot, directory);
      if (!searchDir.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      try {
        const exts = fileExtensions ?? [".ts", ".tsx", ".js", ".jsx"];
        const results: { file: string; line: number; content: string }[] = [];
        const MAX_RESULTS = 30;

        const walkSearch = async (dir: string): Promise<void> => {
          if (results.length >= MAX_RESULTS) return;
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= MAX_RESULTS) break;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
              if (entry.name === "node_modules" || entry.name === ".git")
                continue;
              await walkSearch(full);
            } else if (exts.some((ext: string) => entry.name.endsWith(ext))) {
              try {
                const content = await readFile(full, "utf8");
                const lines = content.split("\n");
                const regex = new RegExp(pattern, "gi");
                for (let i = 0; i < lines.length; i++) {
                  if (regex.test(lines[i])) {
                    results.push({
                      file: relative(projectRoot, full),
                      line: i + 1,
                      content: lines[i].trim().slice(0, 200),
                    });
                    if (results.length >= MAX_RESULTS) break;
                  }
                  regex.lastIndex = 0;
                }
              } catch {
                // skip unreadable files
              }
            }
          }
        };

        await walkSearch(searchDir);
        return {
          matches: results,
          totalMatches: results.length,
          truncated: results.length >= MAX_RESULTS,
        };
      } catch {
        return { error: `Search failed in ${directory}` };
      }
    },
  });

  return { readFileTool, listDirectoryTool, searchCodeTool };
};

const runSkill = (
  skillId: string,
  skillDescription: string,
  inputContent: string,
  inputPath: string,
  override?: LlmOverride,
  onChunk?: StreamCallback,
  log: LogFn = noopLog,
): ResultAsync<string, never> => {
  const instructions = [
    `You are an expert code analysis agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    "You have access to tools that let you read files and explore the project.",
    "Use these tools to examine actual source code before making conclusions.",
    "",
    "IMPORTANT: You have a limited number of tool-call steps. Be strategic:",
    "- Use searchCode first to find relevant files quickly",
    "- Only readFile for files that are directly relevant",
    "- Stop exploring after you have enough evidence (5-10 files max)",
    "- ALWAYS produce a complete Markdown report as your FINAL response",
    "",
    "Workflow:",
    "1. Use searchCode to find patterns matching the analysis criteria",
    "2. Use readFile on the most relevant files found",
    "3. Once you have enough evidence, STOP making tool calls",
    "4. Write a detailed Markdown report with file paths, line numbers, and code snippets",
    "",
    "Your final message MUST be the complete report. Do NOT end with a tool call.",
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
      await log(
        `[Mastra] runSkill: skillId=${skillId}, input length=${inputContent.length}, inputPath=${inputPath}`,
      );
      await log(
        `[Mastra] runSkill: instructions length=${instructions.length}`,
      );

      // Use Mastra Agent with tools if we have a project path
      if (inputPath) {
        const modelConfig = await getMastraModelConfig(override, log);
        if (!modelConfig) {
          await log(
            `[Mastra] runSkill: No model config — returning fallback report`,
          );
          return generateFallbackReport();
        }

        const { readFileTool, listDirectoryTool, searchCodeTool } =
          buildSkillTools(inputPath);

        const agent = new Agent({
          id: `skill-${skillId}`,
          name: `Skill: ${skillId}`,
          instructions,
          model: modelConfig,
          tools: {
            readFile: readFileTool,
            listDirectory: listDirectoryTool,
            searchCode: searchCodeTool,
          },
        });

        await log(
          `[Mastra] runSkill: Starting agent.generate (tool-use mode)...`,
        );

        let result;
        try {
          result = await agent.generate(userPrompt, {
            maxSteps: 25,
          });
        } catch (agentErr) {
          const errMsg =
            agentErr instanceof Error ? agentErr.message : String(agentErr);
          await log(`[Mastra] runSkill: agent.generate THREW — ${errMsg}`);
          console.error("[runSkill] agent.generate error:", agentErr);
          return generateFallbackReport();
        }

        const stepCount = result.steps?.length ?? 0;
        const toolCallCount = (result.steps ?? []).reduce(
          (acc, step) => acc + (step.toolCalls?.length ?? 0),
          0,
        );
        await log(
          `[Mastra] runSkill: Agent complete, steps=${stepCount}, tool calls=${toolCallCount}, output=${result.text.length} chars`,
        );

        if (onChunk) await onChunk(result.text);

        if (result.text.length === 0) {
          await log(
            `[Mastra] runSkill: WARNING — Agent returned empty output, using fallback report`,
          );
          return generateFallbackReport();
        }
        return result.text;
      }

      // Fallback to streaming without tools if no project path
      const model = await getLlmModel(override, log);
      if (!model) {
        await log(
          `[Mastra] runSkill: No LLM model — returning fallback report`,
        );
        return generateFallbackReport();
      }
      await log(`[Mastra] runSkill: Starting streamText (no project path)...`);
      const result = streamText({
        model,
        system: instructions,
        prompt: userPrompt,
      });
      let accumulated = "";
      let chunkCount = 0;
      for await (const chunk of result.textStream) {
        chunkCount++;
        accumulated += chunk;
        if (onChunk) await onChunk(accumulated);
      }
      await log(
        `[Mastra] runSkill: Stream complete, chunks=${chunkCount}, total output=${accumulated.length} chars`,
      );
      if (accumulated.length === 0) {
        await log(
          `[Mastra] runSkill: WARNING — LLM returned empty output, using fallback report`,
        );
        return generateFallbackReport();
      }
      return accumulated;
    })(),
    (cause) => cause,
  ).orElse((cause) => {
    const errMsg = cause instanceof Error ? cause.message : String(cause);
    log(`[Mastra] runSkill: Agent call FAILED — ${errMsg}`);
    console.error("[runSkill] Agent call failed:", cause);
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
      const excludedPaths: string[] = Array.isArray(data.excludedPaths)
        ? data.excludedPaths
        : [];
      if (p && existsSync(p)) {
        inputPath = p;
        const tree = await listDirTree(p, { excludedPaths });
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
      const disclosureMode = ghData.disclosureMode ?? "tree";
      const excludedPaths: string[] = Array.isArray(ghData.excludedPaths)
        ? ghData.excludedPaths
        : [];

      const buildProjectContent = async (
        dir: string,
        label: string,
      ): Promise<string> => {
        const treeOpts = { excludedPaths };
        if (disclosureMode === "tree") {
          const tree = await listDirTree(dir, treeOpts);
          await log(
            `Disclosure mode: tree (${tree.split("\n").length} entries, excluded: [${excludedPaths.join(", ")}])`,
          );
          return `${label}\n\nFile tree:\n${tree}`;
        }
        if (disclosureMode === "full") {
          const tree = await listDirTree(dir, treeOpts);
          const fileContents = await readProjectFiles(dir, { excludedPaths });
          await log(
            `Disclosure mode: full (tree + file contents, ${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
          );
          return `${label}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
        }
        // files-only: just file contents, no tree
        const fileContents = await readProjectFiles(dir, { excludedPaths });
        await log(
          `Disclosure mode: files-only (${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
        );
        return `${label}\n\nFile contents:\n\n${fileContents}`;
      };

      // Local folder source
      if (ghData.sourceType === "local") {
        const localPath = ghData.localPath ?? "";
        if (!localPath) {
          await log(
            `WARNING: GitHub project node (local) missing localPath, skipping`,
          );
          await log(`@@NODE_FAIL::${node.id}`);
          continue;
        }
        await log(`Using local folder: ${localPath}`);
        inputPath = localPath;
        currentContent = await buildProjectContent(
          localPath,
          `Local Folder: ${localPath}`,
        );
        await log(`@@NODE_DONE::${node.id}`);
        continue;
      }

      // GitHub remote source
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
      currentContent = await buildProjectContent(
        clonedDir,
        `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`,
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
          log,
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
          log,
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
