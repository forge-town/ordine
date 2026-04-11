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
  LoopNodeData,
  LoopPassOperator,
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
import {
  OperationOutputSchema,
  CheckOutputSchema,
  FixOutputSchema,
} from "@/schemas/OperationOutputSchema";
import { z as zv4 } from "zod/v4";

// ─── Example instances for LLM instruction prompts ───────────────────────────
// These are validated against the Zod schemas at import time to stay in sync.

const CHECK_OUTPUT_EXAMPLE = {
  type: "check" as const,
  summary: "Executive summary of the check results",
  findings: [
    {
      id: "FINDING_001",
      severity: "error" as const,
      message: "One-line description of the issue",
      file: "relative/path/to/file.ts",
      line: 42,
      rule: "rule-name",
      snippet: "short code snippet showing the violation",
      suggestion: "how to fix the issue",
      skipped: false,
      skipReason: "reason if skipped (only when skipped=true)",
    },
  ],
  stats: {
    totalFiles: 10,
    totalFindings: 5,
    errors: 2,
    warnings: 2,
    infos: 1,
    skipped: 1,
  },
};
CheckOutputSchema.parse(CHECK_OUTPUT_EXAMPLE); // compile-time sync guard

const FIX_OUTPUT_EXAMPLE = {
  type: "fix" as const,
  summary: "Summary of all changes made",
  changes: [
    {
      file: "relative/path/to/file.ts",
      action: "replace" as const,
      description: "What was changed",
      findingId: "FINDING_001",
    },
  ],
  remainingFindings: [
    {
      id: "FINDING_002",
      severity: "warning" as const,
      message: "Issue that could not be auto-fixed",
      file: "relative/path/to/other.ts",
    },
  ],
  stats: {
    totalChanges: 3,
    filesModified: 2,
    findingsFixed: 3,
    findingsSkipped: 1,
  },
};
FixOutputSchema.parse(FIX_OUTPUT_EXAMPLE); // compile-time sync guard

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

// ─── Loop condition evaluator ─────────────────────────────────────────────────

const OPERATOR_FNS: Record<
  LoopPassOperator,
  (actual: number, target: number) => boolean
> = {
  eq: (a, t) => a === t,
  lte: (a, t) => a <= t,
  gte: (a, t) => a >= t,
  lt: (a, t) => a < t,
  gt: (a, t) => a > t,
};

/**
 * Evaluates a loop pass condition against the current pipeline content.
 * The content should be structured JSON (check/fix output). The condition's `field`
 * is a dot-separated path into the parsed JSON (e.g. "stats.errors").
 * Returns `true` if the condition is met (loop should stop).
 */
export const evaluateLoopCondition = (
  content: string,
  field: string,
  operator: LoopPassOperator,
  value: number,
): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return false;
  }

  // Walk the dot path to extract the field value
  let current: unknown = parsed;
  for (const key of field.split(".")) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    )
      return false;
    current = (current as Record<string, unknown>)[key];
  }

  if (typeof current !== "number") return false;

  return OPERATOR_FNS[operator](current, value);
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

const buildSkillTools = (
  projectRoot: string,
  opts?: { writeEnabled?: boolean },
) => {
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

  if (!opts?.writeEnabled) {
    return {
      readFileTool,
      listDirectoryTool,
      searchCodeTool,
      writeEnabled: false as const,
    };
  }

  // ── Write tools (only for implement-mode operations) ──────────────────

  const writeFileTool = createTool({
    id: "writeFile",
    description:
      "Write content to a file. Creates the file if it does not exist, or overwrites it entirely. Use replaceInFile for surgical edits.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "Relative file path from the project root, e.g. 'src/utils/helpers.ts'",
        ),
      content: z.string().describe("The full file content to write"),
    }),
    execute: async ({ path: relPath, content }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      try {
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content, "utf8");
        return { written: true, path: relPath, size: content.length };
      } catch {
        return { error: `Failed to write: ${relPath}` };
      }
    },
  });

  const replaceInFileTool = createTool({
    id: "replaceInFile",
    description:
      "Replace an exact string occurrence in a file. The oldString must match exactly (including whitespace and indentation). Safer than writeFile for small edits.",
    inputSchema: z.object({
      path: z.string().describe("Relative file path from the project root"),
      oldString: z
        .string()
        .describe(
          "The exact literal text to find and replace. Must appear exactly once in the file.",
        ),
      newString: z.string().describe("The replacement text"),
    }),
    execute: async ({ path: relPath, oldString, newString }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      try {
        const content = await readFile(fullPath, "utf8");
        const count = content.split(oldString).length - 1;
        if (count === 0) {
          return { error: "oldString not found in file" };
        }
        if (count > 1) {
          return {
            error: `oldString appears ${count} times — must be unique. Add more context.`,
          };
        }
        const updated = content.replace(oldString, newString);
        await writeFile(fullPath, updated, "utf8");
        return { replaced: true, path: relPath };
      } catch {
        return { error: `Failed to edit: ${relPath}` };
      }
    },
  });

  return {
    readFileTool,
    listDirectoryTool,
    searchCodeTool,
    writeFileTool,
    replaceInFileTool,
    writeEnabled: true as const,
  };
};

// ─── Structured JSON extraction ──────────────────────────────────────────────

/**
 * Extracts structured JSON from an LLM response that may contain ```json fences
 * or surrounding prose. Validates against OperationOutputSchema.
 * Returns the clean JSON string if valid, otherwise returns the original text.
 */
const extractStructuredOutput = (
  rawText: string,
  log: (line: string) => Promise<void>,
): string => {
  // Try to extract JSON from ```json ... ``` fenced block
  const fenceMatch = rawText.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : rawText.trim();

  // Try to parse as JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // If fenced extraction failed, try to find a top-level JSON object in the text
    const objectMatch = rawText.match(
      /\{[\s\S]*"type"\s*:\s*"(?:check|fix)"[\s\S]*\}/,
    );
    if (objectMatch) {
      try {
        parsed = JSON.parse(objectMatch[0]);
      } catch {
        void log(
          "[extractStructuredOutput] No valid JSON found — returning raw text",
        );
        return rawText;
      }
    } else {
      void log(
        "[extractStructuredOutput] No JSON-like content found — returning raw text",
      );
      return rawText;
    }
  }

  // Validate against schema
  const result = OperationOutputSchema.safeParse(parsed);
  if (result.success) {
    void log(
      `[extractStructuredOutput] Valid ${result.data.type} output with ${
        result.data.type === "check"
          ? `${result.data.findings.length} findings`
          : `${result.data.changes.length} changes`
      }`,
    );
    return JSON.stringify(result.data, null, 2);
  }

  void log(
    `[extractStructuredOutput] JSON parsed but schema validation failed — ${zv4.prettifyError(result.error)}. Returning raw text`,
  );
  return rawText;
};

// ─── JSON → Markdown converter for structured operation output ───────────────

/**
 * Converts structured CheckOutput/FixOutput JSON to human-readable Markdown.
 * Returns the original content unchanged if it's not valid structured JSON.
 */
const structuredJsonToMarkdown = (content: string): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }

  const result = OperationOutputSchema.safeParse(parsed);
  if (!result.success) return content;

  const data = result.data;
  const lines: string[] = [];

  if (data.type === "check") {
    lines.push(`# Check Report`, "");
    lines.push(`> ${data.summary}`, "");
    lines.push(
      `| Metric | Count |`,
      `|--------|-------|`,
      `| Files scanned | ${data.stats.totalFiles} |`,
      `| Total findings | ${data.stats.totalFindings} |`,
      `| Errors | ${data.stats.errors} |`,
      `| Warnings | ${data.stats.warnings} |`,
      `| Info | ${data.stats.infos} |`,
      `| Skipped | ${data.stats.skipped} |`,
      "",
    );

    if (data.findings.length > 0) {
      lines.push(`## Findings`, "");
      for (const f of data.findings) {
        const badge =
          f.severity === "error"
            ? "🔴"
            : f.severity === "warning"
              ? "🟡"
              : "🔵";
        const skip = f.skipped
          ? ` _(skipped: ${f.skipReason ?? "allowed exception"})_`
          : "";
        lines.push(`### ${badge} ${f.id}: ${f.message}${skip}`, "");
        lines.push(
          `- **File:** \`${f.file}\`${f.line ? ` (line ${f.line})` : ""}`,
        );
        if (f.rule) lines.push(`- **Rule:** \`${f.rule}\``);
        if (f.snippet)
          lines.push(
            `- **Snippet:**`,
            `  \`\`\``,
            `  ${f.snippet}`,
            `  \`\`\``,
          );
        if (f.suggestion) lines.push(`- **Suggestion:** ${f.suggestion}`);
        lines.push("");
      }
    } else {
      lines.push("## Findings", "", "No findings.", "");
    }
  } else {
    lines.push(`# Fix Report`, "");
    lines.push(`> ${data.summary}`, "");
    lines.push(
      `| Metric | Count |`,
      `|--------|-------|`,
      `| Total changes | ${data.stats.totalChanges} |`,
      `| Files modified | ${data.stats.filesModified} |`,
      `| Findings fixed | ${data.stats.findingsFixed} |`,
      `| Findings skipped | ${data.stats.findingsSkipped} |`,
      "",
    );

    if (data.changes.length > 0) {
      lines.push(`## Changes`, "");
      for (const c of data.changes) {
        lines.push(
          `- **\`${c.file}\`** [${c.action}]: ${c.description}${c.findingId ? ` (fixes ${c.findingId})` : ""}`,
        );
      }
      lines.push("");
    }

    if (data.remainingFindings.length > 0) {
      lines.push(`## Remaining Findings`, "");
      for (const f of data.remainingFindings) {
        const badge =
          f.severity === "error"
            ? "🔴"
            : f.severity === "warning"
              ? "🟡"
              : "🔵";
        lines.push(
          `- ${badge} **${f.id}**: ${f.message} — \`${f.file}\`${f.line ? `:${f.line}` : ""}`,
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
};

const runSkill = (
  skillId: string,
  skillDescription: string,
  inputContent: string,
  inputPath: string,
  override?: LlmOverride,
  onChunk?: StreamCallback,
  log: LogFn = noopLog,
  opts?: { writeEnabled?: boolean },
): ResultAsync<string, never> => {
  const isImplementMode = opts?.writeEnabled === true;

  const CHECK_JSON_EXAMPLE = JSON.stringify(CHECK_OUTPUT_EXAMPLE, null, 2);
  const FIX_JSON_EXAMPLE = JSON.stringify(FIX_OUTPUT_EXAMPLE, null, 2);

  const checkInstructions = [
    `You are an expert code analysis agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    "You have access to tools that let you read files and explore the project.",
    "Use these tools to examine actual source code before making conclusions.",
    "",
    "CRITICAL CONSTRAINT — You have a HARD LIMIT of 25 tool-call steps.",
    "If you exceed this limit, your response will be CUT OFF and LOST entirely.",
    "Budget your steps wisely:",
    "  Phase 1 (steps 1-5): Use searchCode and listDirectory to find relevant files",
    "  Phase 2 (steps 6-18): Use readFile on the most important files found",
    "  Phase 3 (step 19+): STOP all tool calls and write your report",
    "",
    "DO NOT call any more tools after step 18. Write the report immediately.",
    "If in doubt whether to read one more file or write the report — WRITE THE REPORT.",
    "",
    "OUTPUT FORMAT: Your final message MUST be a single JSON object wrapped in ```json fences.",
    "Output data conforming to this structure (replace example values with real data):",
    "```json",
    CHECK_JSON_EXAMPLE,
    "```",
    "",
    "Include specific file paths, line numbers, code snippets, and suggestions.",
    "Mark findings that are allowed exceptions with skipped: true and provide skipReason.",
    "NEVER end your response with a tool call. Always end with the JSON output.",
  ].join("\n");

  const implementInstructions = [
    `You are an expert code refactoring agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    "You have access to tools that let you read AND WRITE files in the project.",
    "Your goal is to FIX the violations described in the input.",
    "",
    "Available tools:",
    "  - readFile: read a file's content",
    "  - listDirectory: list directory contents",
    "  - searchCode: search for text patterns in files",
    "  - replaceInFile: replace an exact string in a file (preferred for surgical edits)",
    "  - writeFile: write entire file content (use for new files or full rewrites)",
    "",
    "CRITICAL CONSTRAINT — You have a HARD LIMIT of 25 tool-call steps.",
    "Budget your steps wisely:",
    "  Phase 1 (steps 1-3): Parse the input to understand what needs fixing",
    "  Phase 2 (steps 4-20): Read affected files, then use replaceInFile to fix each violation",
    "  Phase 3 (step 21+): STOP all tool calls and write the output",
    "",
    "RULES:",
    "- Always use replaceInFile when possible (safer than writeFile)",
    "- Read the file first before editing to ensure correct context",
    "- Do NOT change code that is not directly related to the violations",
    "- Skip violations that are allowable exceptions (framework boundaries, startup validators, React context hooks)",
    "",
    "OUTPUT FORMAT: Your final message MUST be a single JSON object wrapped in ```json fences.",
    "Output data conforming to this structure (replace example values with real data):",
    "```json",
    FIX_JSON_EXAMPLE,
    "```",
    "",
    "NEVER end your response with a tool call. Always end with the JSON output.",
  ].join("\n");

  const instructions = isImplementMode
    ? implementInstructions
    : checkInstructions;

  const userPrompt = inputPath
    ? `Project path: ${inputPath}\n\nInput:\n${inputContent}`
    : `Input:\n${inputContent}`;

  const generateFallbackReport = (): string => {
    const fallback = isImplementMode
      ? {
          type: "fix" as const,
          summary: `LLM analysis unavailable for skill "${skillId}". No changes made.`,
          changes: [],
          remainingFindings: [],
          stats: {
            totalChanges: 0,
            filesModified: 0,
            findingsFixed: 0,
            findingsSkipped: 0,
          },
        }
      : {
          type: "check" as const,
          summary: `LLM analysis unavailable for skill "${skillId}". Input forwarded as-is.`,
          findings: [],
          stats: {
            totalFiles: 0,
            totalFindings: 0,
            errors: 0,
            warnings: 0,
            infos: 0,
            skipped: 0,
          },
        };
    return JSON.stringify(fallback, null, 2);
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

        const skillTools = buildSkillTools(inputPath, {
          writeEnabled: isImplementMode,
        });

        const agent = new Agent({
          id: `skill-${skillId}`,
          name: `Skill: ${skillId}`,
          instructions,
          model: modelConfig,
          tools: skillTools.writeEnabled
            ? {
                readFile: skillTools.readFileTool,
                listDirectory: skillTools.listDirectoryTool,
                searchCode: skillTools.searchCodeTool,
                writeFile: skillTools.writeFileTool,
                replaceInFile: skillTools.replaceInFileTool,
              }
            : {
                readFile: skillTools.readFileTool,
                listDirectory: skillTools.listDirectoryTool,
                searchCode: skillTools.searchCodeTool,
              },
        });

        await log(
          `[Mastra] runSkill: Starting agent.generate (tool-use mode)...`,
        );

        let result;
        const MAX_ATTEMPTS = 2;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            result = await agent.generate(userPrompt, {
              maxSteps: 25,
              ...(attempt > 1
                ? {
                    providerOptions: {
                      openai: { reasoning_effort: "none" },
                    },
                  }
                : {}),
            });
            break; // success
          } catch (agentErr) {
            const errMsg =
              agentErr instanceof Error ? agentErr.message : String(agentErr);
            const isThinkingError = errMsg.includes("reasoning_content");
            await log(
              `[Mastra] runSkill: agent.generate THREW (attempt ${attempt}/${MAX_ATTEMPTS}) — ${errMsg}`,
            );

            if (isThinkingError && attempt < MAX_ATTEMPTS) {
              await log(
                `[Mastra] runSkill: Retrying with reasoning disabled...`,
              );
              continue;
            }

            return generateFallbackReport();
          }
        }

        if (!result) return generateFallbackReport();

        const stepCount = result.steps?.length ?? 0;
        const toolCallCount = (result.steps ?? []).reduce(
          (acc, step) => acc + (step.toolCalls?.length ?? 0),
          0,
        );

        // If result.text is empty, try to salvage text from intermediate steps
        let outputText = result.text;
        if (!outputText && result.steps?.length) {
          const stepTexts = result.steps
            .map((s) => s.text ?? "")
            .filter((t) => t.length > 50);
          if (stepTexts.length > 0) {
            outputText = stepTexts[stepTexts.length - 1];
            await log(
              `[Mastra] runSkill: Salvaged ${outputText.length} chars from step text`,
            );
          }
        }

        await log(
          `[Mastra] runSkill: Agent complete, steps=${stepCount}, tool calls=${toolCallCount}, output=${outputText.length} chars`,
        );

        if (onChunk) await onChunk(outputText);

        if (outputText.length === 0) {
          await log(
            `[Mastra] runSkill: WARNING — Agent returned empty output, using fallback report`,
          );
          return generateFallbackReport();
        }
        return extractStructuredOutput(outputText, log);
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
      return extractStructuredOutput(accumulated, log);
    })(),
    (cause) => cause,
  ).orElse((cause) => {
    const errMsg = cause instanceof Error ? cause.message : String(cause);
    log(`[Mastra] runSkill: Agent call FAILED — ${errMsg}`);
    return ok(generateFallbackReport());
  });
};

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

  // Collect child node IDs from loop nodes (they'll be skipped in the main walk)
  const loopChildIds = new Set<string>();
  for (const n of nodes) {
    if (n.type === "loop") {
      const loopData = n.data as unknown as LoopNodeData;
      for (const childId of loopData.childNodeIds) {
        loopChildIds.add(childId);
      }
    }
  }

  // Helper: execute a single operation node. Returns { ok, content } or error.
  const executeOperationNode = async (
    node: PipelineNode,
  ): Promise<
    | { ok: true; content: string }
    | { ok: false; error: PipelineRunError | null }
  > => {
    const data = node.data as unknown as NodeData;
    const operationId = data.operationId ?? "";
    const operation = operationsMap.get(operationId);

    if (!operation) {
      await log(`WARNING: Operation ${operationId} not found, skipping`);
      await log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }

    const opData = node.data as unknown as {
      llmProvider?: LlmProvider;
      llmModel?: string;
      bestPracticeId?: string;
    };
    const llmOverride: LlmOverride | undefined =
      opData.llmProvider || opData.llmModel
        ? { llmProvider: opData.llmProvider, llmModel: opData.llmModel }
        : undefined;

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

    const configResult = await safeParseJson(operation.config, operation.name);
    if (configResult.isErr()) {
      await log(`WARNING: ${configResult.error.message}, skipping`);
      await log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }

    const config = configResult.value;
    const executor = config.executor;
    if (!executor) {
      await log(
        `WARNING: No executor configured for operation "${operation.name}", skipping`,
      );
      await log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }

    const rawType = executor.type as string;
    if (rawType === "skill" || rawType === "prompt") {
      executor.agentMode = rawType as "skill" | "prompt";
      executor.type = "agent";
    }

    await log(`Executing operation "${operation.name}" (${executor.type})`);

    let lastChunkTime = 0;
    const CHUNK_THROTTLE_MS = 2000;
    const handleChunk = async (accumulated: string) => {
      const now = Date.now();
      if (now - lastChunkTime >= CHUNK_THROTTLE_MS) {
        lastChunkTime = now;
        await log(`@@LLM_CONTENT::${node.id}::${accumulated}`);
      }
    };

    const effectiveInput = bestPracticeContent
      ? `## Standards (Best Practice)\n\n${bestPracticeContent}\n\n---\n\n${currentContent}`
      : currentContent;

    let result = "";

    if (executor.type === "script") {
      const scriptResult = await runScript(executor, inputPath, currentContent);
      if (scriptResult.isErr()) {
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: scriptResult.error };
      }
      result = scriptResult.value;
      await log(`Script output (${result.length} chars)`);
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
      result = promptResult.value;
      await log(`@@LLM_CONTENT::${node.id}::${result}`);
      await log(`Prompt output (${result.length} chars)`);
    } else if (executor.type === "agent" && executor.agentMode === "skill") {
      const skillId = executor.skillId ?? "";
      if (!skillId) {
        await log(
          `WARNING: No skillId configured for operation "${operation.name}", skipping`,
        );
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: null };
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
        { writeEnabled: executor.writeEnabled === true },
      );
      result = skillResult.isOk() ? skillResult.value : "";
      await log(`@@LLM_CONTENT::${node.id}::${result}`);
      await log(`Skill output (${result.length} chars)`);
    }

    return { ok: true, content: result };
  };

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
    // Skip nodes that are children of a loop node (they're executed by the loop)
    if (loopChildIds.has(node.id)) continue;

    const data = node.data as unknown as NodeData;
    await log(
      `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`,
    );
    await log(`@@NODE_START::${node.id}`);

    // ── Loop node ────────────────────────────────────────────────────────
    if (node.type === "loop") {
      const loopData = node.data as unknown as LoopNodeData;
      const { childNodeIds, maxIterations, passCondition } = loopData;
      const childNodes = childNodeIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is PipelineNode => n !== undefined);

      await log(
        `Loop: ${childNodes.length} child nodes, max ${maxIterations} iterations, pass when ${passCondition.field} ${passCondition.operator} ${passCondition.value}`,
      );

      let passed = false;
      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        await log(
          `@@LOOP_ITERATION::${node.id}::${iteration}/${maxIterations}`,
        );

        for (const child of childNodes) {
          const childData = child.data as unknown as NodeData;
          await log(
            `Processing node [${child.type}] ${(childData as Record<string, unknown>).label ?? child.id} (loop iteration ${iteration})`,
          );
          await log(`@@NODE_START::${child.id}`);

          if (child.type === "operation") {
            const opResult = await executeOperationNode(child);
            if (opResult.ok) {
              currentContent = opResult.content;
            } else if (opResult.error) {
              await log(`@@NODE_DONE::${node.id}`);
              return { ok: false, error: opResult.error };
            }
          } else if (child.type === "output-project-path") {
            const projPath =
              (childData as Record<string, unknown>).path ?? inputPath;
            await log(
              `Output-to-project: changes written directly to ${projPath}`,
            );
          }

          await log(`@@NODE_DONE::${child.id}`);
        }

        // Evaluate pass condition on currentContent
        const conditionMet = evaluateLoopCondition(
          currentContent,
          passCondition.field,
          passCondition.operator,
          passCondition.value,
        );

        if (conditionMet) {
          await log(
            `Loop passed on iteration ${iteration}: ${passCondition.field} ${passCondition.operator} ${passCondition.value}`,
          );
          passed = true;
          break;
        }

        await log(
          `Loop condition not met on iteration ${iteration}, ${iteration < maxIterations ? "continuing..." : "max iterations reached"}`,
        );
      }

      if (!passed) {
        await log(
          `Loop exited after ${maxIterations} iterations without passing condition — continuing pipeline`,
        );
      }

      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

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
        // Auto-convert structured JSON to Markdown when outputting to .md files
        const outputContent =
          extname(outputLocalPath) === ".md"
            ? structuredJsonToMarkdown(currentContent)
            : currentContent;
        await mkdir(dirname(outputLocalPath), { recursive: true });
        await writeFile(outputLocalPath, outputContent, "utf8");
        await log(
          `Wrote output to: ${outputLocalPath} (${outputContent.length} chars)`,
        );
      }
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // ── Operation nodes ──────────────────────────────────────────────────
    if (node.type === "operation") {
      const opResult = await executeOperationNode(node);
      if (opResult.ok) {
        currentContent = opResult.content;
      } else if (opResult.error) {
        return { ok: false, error: opResult.error };
      }

      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // ── Output-to-project node ───────────────────────────────────────────
    if (node.type === "output-project-path") {
      // The implement-mode operation already wrote files to the project root
      // via writeFile/replaceInFile tools. This node simply acknowledges that
      // the project was modified and logs a summary.
      const projPath = (data as Record<string, unknown>).path ?? inputPath;
      await log(`Output-to-project: changes written directly to ${projPath}`);
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // Skip unknown node types
    await log(`Skipped node type: ${node.type}`);
    await log(`@@NODE_DONE::${node.id}`);
  }

  const summary = outputLocalPath
    ? `Output written to ${outputLocalPath}`
    : `Completed (no output-local-path node configured)`;

  await log(`Pipeline complete. ${summary}`);

  // Cleanup temp directories
  for (const dir of tempDirs) {
    await ResultAsync.fromPromise(
      rm(dir, { recursive: true, force: true }),
      () => undefined,
    );
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
