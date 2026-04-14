/**
 * Pipeline execution engine.
 *
 * Traverses pipeline nodes in topological order and executes each one,
 * passing results between nodes. Supports four executor types:
 *   - script     → runs a shell/python/js command via child_process
 *   - prompt     → sends input to an AI model via @ai-sdk/openai
 *   - skill      → looks up skill metadata and delegates to an AI model
 *   - rule-check → scans files against enabled rules with regex patterns
 *
 * Progress is tracked through a Job record in the DB.
 */

import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { streamText } from "ai";
import { ResultAsync, ok } from "neverthrow";
import { type SettingsResolver } from "@repo/agent";
import {
  runPrompt as runPromptAgent,
  runSkill as runSkillAgent,
  structuredJsonToMarkdown,
} from "@/mastra";
import type {
  PipelineNode,
  PipelineEdge,
  GitHubProjectNodeData,
  OutputMode,
} from "@/models/types/pipelineGraph";
import { type OperationEntity, operationsDao } from "@/models/daos/operationsDao";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { jobsDao } from "@/models/daos/jobsDao";
import { skillsDao } from "@/models/daos/skillsDao";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";
import { settingsDao } from "@/models/daos/settingsDao";
import type { ExecutorConfig } from "@/pages/OperationDetailPage/types";
import { listDirTree, readProjectFiles } from "@/services/filesystemService";
import { getModel } from "@/services/llmService";

const getSettings: SettingsResolver = async () => {
  const s = await settingsDao.get();

  return { apiKey: s.llmApiKey, model: s.llmModel };
};

const execAsync = promisify(exec);

// ─── types ────────────────────────────────────────────────────────────────────

interface NodeData {
  nodeType?: string;
  folderPath?: string;
  excludedPaths?: string[];
  disclosureMode?: "tree" | "full" | "files-only";
  includedExtensions?: string[];
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

class ConfigParseError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly cause?: unknown,
  ) {
    super(`Could not parse config for operation ${operationName}`);
    this.name = "ConfigParseError";
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
  | ConfigParseError
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

// ─── main runner ──────────────────────────────────────────────────────────────

const executePipeline = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
  githubToken?: string;
}): Promise<{ ok: true; summary: string } | { ok: false; error: PipelineRunError }> => {
  const { pipelineId, jobId, githubToken } = opts;
  const ctx = { inputPath: opts.inputPath ?? "", currentContent: "", outputLocalPath: "" };
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

  // Context accumulates output across nodes — stored in ctx object above

  // Helper: evaluate whether a loop condition is met (returns true = condition passed)
  const evaluateLoopCondition = async (
    conditionPrompt: string,
    operationOutput: string,
    modelOverride?: string,
  ): Promise<boolean> => {
    const model = await getModel(modelOverride);
    if (!model) {
      await log(`[Loop] No LLM configured — treating condition as PASS`);
      return true;
    }
    const evalPrompt = `You are a strict evaluator. Given the following acceptance criteria and the operation output, determine if the output meets the criteria.

## Acceptance Criteria
${conditionPrompt}

## Operation Output
${operationOutput}

Respond with EXACTLY one word: "PASS" if the criteria are met, or "FAIL" if not. Do not explain.`;

    const result = streamText({ model, prompt: evalPrompt });
    const chunks: string[] = [];
    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }
    const verdict = chunks.join("").trim().toUpperCase();
    await log(`[Loop] Condition evaluation result: ${verdict}`);
    return verdict.startsWith("PASS");
  };

  // Helper: execute a single operation node. Returns { ok, content } or error.
  const executeOperationNode = async (
    node: PipelineNode,
  ): Promise<{ ok: true; content: string } | { ok: false; error: PipelineRunError | null }> => {
    const data = node.data as unknown as NodeData;
    const operationId = data.operationId ?? "";
    const operation = operationsMap.get(operationId);

    if (!operation) {
      await log(`WARNING: Operation ${operationId} not found, skipping`);
      await log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }

    const opData = node.data as unknown as {
      llmModel?: string;
      bestPracticeId?: string;
    };
    const modelOverride = opData.llmModel ?? undefined;

    const bestPracticeContent = await (async () => {
      if (!opData.bestPracticeId) return "";
      const bp = await bestPracticesDao.findById(opData.bestPracticeId);
      if (bp) {
        await log(`Loaded best practice "${bp.title}" (${bp.content.length} chars)`);
        return bp.content;
      }
      await log(
        `WARNING: Best practice ${opData.bestPracticeId} not found, continuing without standards`,
      );
      return "";
    })();

    const configResult = await safeParseJson(operation.config, operation.name);
    if (configResult.isErr()) {
      await log(`WARNING: ${configResult.error.message}, skipping`);
      await log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }

    const config = configResult.value;
    const executor = config.executor;
    if (!executor) {
      await log(`WARNING: No executor configured for operation "${operation.name}", skipping`);
      await log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: null };
    }

    const rawType = executor.type as string;
    if (rawType === "skill" || rawType === "prompt") {
      executor.agentMode = rawType as "skill" | "prompt";
      executor.type = "agent";
    }

    if (executor.type === "rule-check") {
      const { runRuleCheck } = await import("@/services/ruleCheckRunner");
      await log(`Running rule-check on path: ${ctx.inputPath}`);
      const checkOutput = await runRuleCheck(ctx.inputPath);
      const result = JSON.stringify(checkOutput, null, 2);
      await log(
        `Rule-check: ${checkOutput.stats.totalFindings} findings in ${checkOutput.stats.totalFiles} files`,
      );
      return { ok: true, content: result };
    }

    await log(`Executing operation "${operation.name}" (${executor.type})`);

    const chunkState = { lastTime: 0 };
    const CHUNK_THROTTLE_MS = 2000;
    const handleChunk = async (accumulated: string) => {
      const now = Date.now();
      if (now - chunkState.lastTime >= CHUNK_THROTTLE_MS) {
        chunkState.lastTime = now;
        await log(`@@LLM_CONTENT::${node.id}::${accumulated}`);
      }
    };

    const effectiveInput = bestPracticeContent
      ? `## Standards (Best Practice)\n\n${bestPracticeContent}\n\n---\n\n${ctx.currentContent}`
      : ctx.currentContent;

    const opResult = { value: "" };

    if (executor.type === "script") {
      const scriptResult = await runScript(executor, ctx.inputPath, ctx.currentContent);
      if (scriptResult.isErr()) {
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: scriptResult.error };
      }
      opResult.value = scriptResult.value;
      await log(`Script output (${opResult.value.length} chars)`);
    } else if (executor.type === "agent" && executor.agentMode === "prompt") {
      const prompt = executor.prompt ?? "";
      if (!prompt.trim()) {
        await log(`WARNING: Prompt text is empty for operation "${operation.name}", skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: null };
      }
      const promptResult = await runPromptAgent({
        prompt,
        inputContent: effectiveInput,
        getSettings,
        modelOverride,
        onChunk: handleChunk,
        onProgress: log,
      });
      if (promptResult.isErr()) {
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: new ScriptExecutionError(promptResult.error.message) };
      }
      opResult.value = promptResult.value;
      await log(`@@LLM_CONTENT::${node.id}::${opResult.value}`);
      await log(`Prompt output (${opResult.value.length} chars)`);
    } else if (executor.type === "agent" && executor.agentMode === "skill") {
      const skillId = executor.skillId ?? "";
      if (!skillId) {
        await log(`WARNING: No skillId configured for operation "${operation.name}", skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: null };
      }

      const skill = (await skillsDao.findById(skillId)) ?? (await skillsDao.findByName(skillId));
      const skillDescription = skill
        ? `${skill.label}: ${skill.description}`
        : `Skill "${skillId}" (no description available)`;

      await log(`Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`);
      const skillResult = await runSkillAgent({
        skillId,
        skillDescription,
        inputContent: effectiveInput,
        inputPath: ctx.inputPath,
        getSettings,
        modelOverride,
        onChunk: handleChunk,
        onProgress: log,
        writeEnabled: executor.writeEnabled === true,
      });
      opResult.value = skillResult.isOk() ? skillResult.value : "";
      await log(`@@LLM_CONTENT::${node.id}::${opResult.value}`);
      await log(`Skill output (${opResult.value.length} chars)`);
    }

    return { ok: true, content: opResult.value };
  };

  // Resolve initial input if a path was given
  if (ctx.inputPath && existsSync(ctx.inputPath)) {
    const readResult = await safeReadInputFile(ctx.inputPath);
    if (readResult.isOk()) {
      const { content, isFile } = readResult.value;
      ctx.currentContent = content;
      if (isFile) {
        await log(`Read input file: ${ctx.inputPath} (${content.length} chars)`);
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
      const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];
      const includedExtensions: string[] | undefined = Array.isArray(data.includedExtensions)
        ? data.includedExtensions
        : undefined;
      const disclosureMode = data.disclosureMode ?? "tree";
      if (p && existsSync(p)) {
        ctx.inputPath = p;
        const tree = await listDirTree(p, { excludedPaths });
        const readOpts = { excludedPaths, includedExtensions };
        if (disclosureMode === "full") {
          const fileContents = await readProjectFiles(p, readOpts);
          ctx.currentContent = `Folder: ${p}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
          await log(
            `Input folder: ${p} (disclosure: full, tree: ${tree.split("\n").length} entries, contents: ${fileContents.length} chars)`,
          );
        } else if (disclosureMode === "files-only") {
          const fileContents = await readProjectFiles(p, readOpts);
          ctx.currentContent = `Folder: ${p}\n\nFile contents:\n\n${fileContents}`;
          await log(`Input folder: ${p} (disclosure: files-only, ${fileContents.length} chars)`);
        } else {
          ctx.currentContent = `Folder: ${p}\n\nFile tree:\n${tree}`;
          await log(`Input folder: ${p} (tree: ${tree.split("\n").length} entries)`);
        }
      }
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    if (node.type === "code-file") {
      const p = data.filePath ?? "";
      if (p && existsSync(p)) {
        ctx.inputPath = p;
        ctx.currentContent = await readFile(p, "utf8");
        await log(`Read code file: ${p} (${ctx.currentContent.length} chars)`);
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

      const buildProjectContent = async (dir: string, label: string): Promise<string> => {
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
          await log(`WARNING: GitHub project node (local) missing localPath, skipping`);
          await log(`@@NODE_FAIL::${node.id}`);
          continue;
        }
        await log(`Using local folder: ${localPath}`);
        ctx.inputPath = localPath;
        ctx.currentContent = await buildProjectContent(localPath, `Local Folder: ${localPath}`);
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
      const cloneResult = await cloneGitHubRepo(owner, repo, branch, githubToken);
      if (cloneResult.isErr()) {
        await log(`ERROR: ${cloneResult.error.message}`);
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: cloneResult.error };
      }

      const clonedDir = cloneResult.value;
      tempDirs.push(clonedDir);
      ctx.inputPath = clonedDir;
      ctx.currentContent = await buildProjectContent(
        clonedDir,
        `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`,
      );
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // ── Output nodes ─────────────────────────────────────────────────────
    if (node.type === "output-local-path") {
      const rawPath: string =
        data.localPath ?? String((data as Record<string, unknown>).path ?? "");
      const outputFileName = data.outputFileName?.trim() || "output.md";
      const outputMode: OutputMode = data.outputMode ?? "overwrite";
      const dualOutput = (data as Record<string, unknown>).dualOutput === true;
      const resolvedPath = (() => {
        const initial = rawPath ? resolve(rawPath) : "";
        const withFile =
          initial && existsSync(initial) && statSync(initial).isDirectory()
            ? join(initial, outputFileName)
            : initial;
        if (withFile && existsSync(withFile) && outputMode === "auto_rename") {
          const dir = dirname(withFile);
          const ext = extname(withFile);
          const base = basename(withFile, ext);
          const rename = { counter: 1, candidate: withFile };
          while (existsSync(rename.candidate)) {
            rename.candidate = join(dir, `${base}_${rename.counter}${ext}`);
            rename.counter++;
          }
          return rename.candidate;
        }
        return withFile;
      })();

      // Handle output mode
      if (resolvedPath && existsSync(resolvedPath)) {
        if (outputMode === "error_if_exists") {
          await log(`ERROR: Output file already exists: ${resolvedPath} (mode: error_if_exists)`);
          await log(`@@NODE_FAIL::${node.id}`);
          return {
            ok: false,
            error: new ScriptExecutionError(
              `Output file already exists: ${resolvedPath}. Pipeline aborted (output mode: error_if_exists).`,
            ),
          };
        }
        if (outputMode === "auto_rename") {
          await log(`Auto-renamed to avoid conflict: ${resolvedPath}`);
        }
        // "overwrite" mode — no special handling, just overwrites below
      }

      ctx.outputLocalPath = resolvedPath;
      await log(
        `Output path set: ${ctx.outputLocalPath} (mode: ${outputMode}, dualOutput: ${dualOutput})`,
      );
      // Write the current content to the output path
      if (ctx.outputLocalPath && ctx.currentContent) {
        if (dualOutput) {
          // Dual output: write both .json and .md into the output directory
          const outputDir = dirname(ctx.outputLocalPath);
          const baseName = basename(ctx.outputLocalPath, extname(ctx.outputLocalPath));
          await mkdir(outputDir, { recursive: true });

          // Strip code fences if present (LLM output may wrap JSON in ```json ... ```)
          const cleanContent = ctx.currentContent
            .replace(/^```json\s*\n?/, "")
            .replace(/\n?\s*```\s*$/, "")
            .trim();

          // Write .json (structured content)
          const jsonPath = join(outputDir, `${baseName}.json`);
          await writeFile(jsonPath, cleanContent, "utf8");
          await log(`Wrote JSON output to: ${jsonPath} (${cleanContent.length} chars)`);

          // Write .md (human-readable, converted from JSON if possible)
          const mdPath = join(outputDir, `${baseName}.md`);
          const mdContent = structuredJsonToMarkdown(cleanContent);
          await writeFile(mdPath, mdContent, "utf8");
          await log(`Wrote Markdown output to: ${mdPath} (${mdContent.length} chars)`);
        } else {
          // Single output: auto-convert structured JSON to Markdown when outputting to .md files
          const outputContent =
            extname(ctx.outputLocalPath) === ".md"
              ? structuredJsonToMarkdown(ctx.currentContent)
              : ctx.currentContent;
          await mkdir(dirname(ctx.outputLocalPath), { recursive: true });
          await writeFile(ctx.outputLocalPath, outputContent, "utf8");
          await log(`Wrote output to: ${ctx.outputLocalPath} (${outputContent.length} chars)`);
        }
      }
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // ── Operation nodes ──────────────────────────────────────────────────
    if (node.type === "operation") {
      const opData = node.data as unknown as {
        loopEnabled?: boolean;
        maxLoopCount?: number;
        loopConditionPrompt?: string;
        llmModel?: string;
      };
      const loopEnabled = opData.loopEnabled === true;
      const maxLoops = opData.maxLoopCount ?? 3;
      const conditionPrompt = opData.loopConditionPrompt ?? "";

      if (loopEnabled && conditionPrompt) {
        const modelOverride = opData.llmModel ?? undefined;

        for (const attempt of Array.from({ length: maxLoops }, (_, i) => i + 1)) {
          await log(
            `[Loop] Iteration ${attempt}/${maxLoops} for "${(node.data as unknown as Record<string, unknown>).label}"`,
          );
          const loopResult = await executeOperationNode(node);
          if (!loopResult.ok) {
            if (loopResult.error) return { ok: false, error: loopResult.error };
            break;
          }
          ctx.currentContent = loopResult.content;

          const passed = await evaluateLoopCondition(
            conditionPrompt,
            ctx.currentContent,
            modelOverride,
          );
          if (passed) {
            await log(`[Loop] Condition PASSED on iteration ${attempt}`);
            break;
          }
          if (attempt === maxLoops) {
            await log(`[Loop] Max iterations (${maxLoops}) reached — proceeding with last result`);
          } else {
            await log(`[Loop] Condition FAILED — retrying...`);
          }
        }
      } else {
        const nodeResult = await executeOperationNode(node);
        if (nodeResult.ok) {
          if (nodeResult.content) {
            ctx.currentContent = nodeResult.content;
          } else {
            await log(`WARNING: Operation returned empty output — keeping previous content`);
          }
        } else if (nodeResult.error) {
          return { ok: false, error: nodeResult.error };
        }
      }

      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // ── Output-to-project node ───────────────────────────────────────────
    if (node.type === "output-project-path") {
      // The implement-mode operation already wrote files to the project root
      // via writeFile/replaceInFile tools. This node simply acknowledges that
      // the project was modified and logs a summary.
      const projPath = (data as Record<string, unknown>).path ?? ctx.inputPath;
      await log(`Output-to-project: changes written directly to ${projPath}`);
      await log(`@@NODE_DONE::${node.id}`);
      continue;
    }

    // Skip unknown node types
    await log(`Skipped node type: ${node.type}`);
    await log(`@@NODE_DONE::${node.id}`);
  }

  const summary = ctx.outputLocalPath
    ? `Output written to ${ctx.outputLocalPath}`
    : `Completed (no output-local-path node configured)`;

  await log(`Pipeline complete. ${summary}`);

  // Cleanup temp directories
  for (const dir of tempDirs) {
    await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
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
