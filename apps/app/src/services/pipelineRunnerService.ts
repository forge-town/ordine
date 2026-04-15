/**
 * Pipeline execution engine — DAG-based concurrent executor.
 *
 * Nodes are partitioned into execution levels via Kahn's algorithm.
 * Nodes within the same level run concurrently via Promise.all.
 * Each node maintains its own output context (NodeCtx), so fan-out
 * branches receive isolated inputs from their parent nodes.
 *
 * Supports four executor types:
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
} from "@repo/db-schema";
import {
  operationsDao,
  pipelinesDao,
  jobsDao,
  skillsDao,
  bestPracticesDao,
  settingsDao,
  rulesDao,
  type OperationEntity,
} from "@repo/models";
import type { ExecutorConfig } from "@/pages/OperationDetailPage/types";
import {
  listDirTree,
  readProjectFiles,
  createLlmService,
  buildExecutionLevels,
  getParentIds,
} from "@repo/services";

const llmService = createLlmService(settingsDao);
const getSettings = llmService.getSettings;
const getModel = llmService.getModel;

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

interface NodeCtx {
  inputPath: string;
  content: string;
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

class ConfigParseError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly cause?: unknown
  ) {
    super(`Could not parse config for operation ${operationName}`);
    this.name = "ConfigParseError";
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
  | ConfigParseError
  | GitCloneError;

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
        cause
      )
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
  const tempDirs: string[] = [];
  const nodeOutputs = new Map<string, NodeCtx>();

  const log = async (line: string) => {
    await jobsDao.appendLog(jobId, `[${new Date().toISOString()}] ${line}`);
  };

  await jobsDao.updateStatus(jobId, "running", { startedAt: Date.now() });
  await log(`Starting pipeline ${pipelineId}`);

  const pipeline = await pipelinesDao.findById(pipelineId);
  if (!pipeline) {
    return { ok: false, error: new PipelineNotFoundError(pipelineId) };
  }

  const nodes = pipeline.nodes as PipelineNode[];
  const edges = pipeline.edges as PipelineEdge[];

  const levels = buildExecutionLevels(nodes, edges);

  await log(
    `Pipeline "${pipeline.name}" loaded. ${nodes.length} nodes in ${levels.length} levels.`
  );

  const operationIds = nodes
    .filter((n) => n.type === "operation")
    .map((n) => (n.data as unknown as NodeData).operationId)
    .filter((id): id is string => id !== undefined && id !== null && id !== "");

  const operationsMap = new Map<string, OperationEntity>();
  for (const id of operationIds) {
    const op = await operationsDao.findById(id);
    if (op) operationsMap.set(id, op);
  }

  // ── Resolve input for a node from its parent outputs ───────────────────

  const resolveNodeInput = (nodeId: string): NodeCtx => {
    const parentIds = getParentIds(nodeId, edges);
    if (parentIds.length === 0) {
      const initial = nodeOutputs.get("__initial__");
      return initial ?? { inputPath: "", content: "" };
    }
    if (parentIds.length === 1) {
      return nodeOutputs.get(parentIds[0]!) ?? { inputPath: "", content: "" };
    }
    const parentCtxs = parentIds
      .map((id) => nodeOutputs.get(id))
      .filter((c): c is NodeCtx => c !== undefined);
    const inputPath = parentCtxs.find((p) => p.inputPath)?.inputPath ?? "";
    const content = parentCtxs
      .map((p) => p.content)
      .filter(Boolean)
      .join("\n\n---\n\n");
    return { inputPath, content };
  };

  // ── Loop condition evaluator ───────────────────────────────────────────

  const evaluateLoopCondition = async (
    conditionPrompt: string,
    operationOutput: string,
    modelOverride?: string
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

  // ── Execute a single operation node with explicit input ────────────────

  const executeOperationNode = async (
    node: PipelineNode,
    input: NodeCtx
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
        `WARNING: Best practice ${opData.bestPracticeId} not found, continuing without standards`
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
      const { runRuleCheck } = await import("@repo/services");
      await log(`Running rule-check on path: ${input.inputPath}`);
      const checkOutput = await runRuleCheck(rulesDao, input.inputPath);
      const checkResult = JSON.stringify(checkOutput, null, 2);
      await log(
        `Rule-check: ${checkOutput.stats.totalFindings} findings in ${checkOutput.stats.totalFiles} files`
      );
      return { ok: true, content: checkResult };
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
      ? `## Standards (Best Practice)\n\n${bestPracticeContent}\n\n---\n\n${input.content}`
      : input.content;

    const opResult = { value: "" };

    if (executor.type === "script") {
      const scriptResult = await runScript(executor, input.inputPath, input.content);
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
        inputPath: input.inputPath,
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

  // ── Process a single node ──────────────────────────────────────────────

  const processNode = async (
    node: PipelineNode
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError }> => {
    const data = node.data as unknown as NodeData;
    const input = resolveNodeInput(node.id);

    await log(
      `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`
    );
    await log(`@@NODE_START::${node.id}`);

    // ── Input: folder ────────────────────────────────────────────────────
    if (node.type === "folder") {
      const p = data.folderPath ?? "";
      const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];
      const includedExtensions: string[] | undefined = Array.isArray(data.includedExtensions)
        ? data.includedExtensions
        : undefined;
      const disclosureMode = data.disclosureMode ?? "tree";
      if (p && existsSync(p)) {
        const tree = await listDirTree(p, { excludedPaths });
        const readOpts = { excludedPaths, includedExtensions };
        const content = await (async () => {
          if (disclosureMode === "full") {
            const fileContents = await readProjectFiles(p, readOpts);
            await log(
              `Input folder: ${p} (disclosure: full, tree: ${tree.split("\n").length} entries, contents: ${fileContents.length} chars)`
            );
            return `Folder: ${p}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
          }
          if (disclosureMode === "files-only") {
            const fileContents = await readProjectFiles(p, readOpts);
            await log(`Input folder: ${p} (disclosure: files-only, ${fileContents.length} chars)`);
            return `Folder: ${p}\n\nFile contents:\n\n${fileContents}`;
          }
          await log(`Input folder: ${p} (tree: ${tree.split("\n").length} entries)`);
          return `Folder: ${p}\n\nFile tree:\n${tree}`;
        })();
        nodeOutputs.set(node.id, { inputPath: p, content });
      } else {
        nodeOutputs.set(node.id, { inputPath: p, content: "" });
      }
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    // ── Input: code-file ─────────────────────────────────────────────────
    if (node.type === "code-file") {
      const p = data.filePath ?? "";
      if (p && existsSync(p)) {
        const content = await readFile(p, "utf8");
        nodeOutputs.set(node.id, { inputPath: p, content });
        await log(`Read code file: ${p} (${content.length} chars)`);
      } else {
        nodeOutputs.set(node.id, { inputPath: p, content: "" });
      }
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    // ── Input: github-project ────────────────────────────────────────────
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
            `Disclosure mode: tree (${tree.split("\n").length} entries, excluded: [${excludedPaths.join(", ")}])`
          );
          return `${label}\n\nFile tree:\n${tree}`;
        }
        if (disclosureMode === "full") {
          const tree = await listDirTree(dir, treeOpts);
          const fileContents = await readProjectFiles(dir, { excludedPaths });
          await log(
            `Disclosure mode: full (tree + file contents, ${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`
          );
          return `${label}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
        }
        const fileContents = await readProjectFiles(dir, { excludedPaths });
        await log(
          `Disclosure mode: files-only (${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`
        );
        return `${label}\n\nFile contents:\n\n${fileContents}`;
      };

      if (ghData.sourceType === "local") {
        const localPath = ghData.localPath ?? "";
        if (!localPath) {
          await log(`WARNING: GitHub project node (local) missing localPath, skipping`);
          await log(`@@NODE_FAIL::${node.id}`);
          nodeOutputs.set(node.id, { inputPath: "", content: "" });
          return { ok: true };
        }
        await log(`Using local folder: ${localPath}`);
        const content = await buildProjectContent(localPath, `Local Folder: ${localPath}`);
        nodeOutputs.set(node.id, { inputPath: localPath, content });
        await log(`@@NODE_DONE::${node.id}`);
        return { ok: true };
      }

      const owner = ghData.owner;
      const repo = ghData.repo;
      const branch = ghData.branch ?? "main";

      if (!owner || !repo) {
        await log(`WARNING: GitHub project node missing owner/repo, skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        nodeOutputs.set(node.id, { inputPath: "", content: "" });
        return { ok: true };
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
      const content = await buildProjectContent(
        clonedDir,
        `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`
      );
      nodeOutputs.set(node.id, { inputPath: clonedDir, content });
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    // ── Output: output-local-path ────────────────────────────────────────
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

      if (resolvedPath && existsSync(resolvedPath)) {
        if (outputMode === "error_if_exists") {
          await log(`ERROR: Output file already exists: ${resolvedPath} (mode: error_if_exists)`);
          await log(`@@NODE_FAIL::${node.id}`);
          return {
            ok: false,
            error: new ScriptExecutionError(
              `Output file already exists: ${resolvedPath}. Pipeline aborted (output mode: error_if_exists).`
            ),
          };
        }
        if (outputMode === "auto_rename") {
          await log(`Auto-renamed to avoid conflict: ${resolvedPath}`);
        }
      }

      await log(
        `Output path set: ${resolvedPath} (mode: ${outputMode}, dualOutput: ${dualOutput})`
      );
      if (resolvedPath && input.content) {
        if (dualOutput) {
          const outputDir = dirname(resolvedPath);
          const baseName = basename(resolvedPath, extname(resolvedPath));
          await mkdir(outputDir, { recursive: true });

          const cleanContent = input.content
            .replace(/^```json\s*\n?/, "")
            .replace(/\n?\s*```\s*$/, "")
            .trim();

          const jsonPath = join(outputDir, `${baseName}.json`);
          await writeFile(jsonPath, cleanContent, "utf8");
          await log(`Wrote JSON output to: ${jsonPath} (${cleanContent.length} chars)`);

          const mdPath = join(outputDir, `${baseName}.md`);
          const mdContent = structuredJsonToMarkdown(cleanContent);
          await writeFile(mdPath, mdContent, "utf8");
          await log(`Wrote Markdown output to: ${mdPath} (${mdContent.length} chars)`);
        } else {
          const outputContent =
            extname(resolvedPath) === ".md"
              ? structuredJsonToMarkdown(input.content)
              : input.content;
          await mkdir(dirname(resolvedPath), { recursive: true });
          await writeFile(resolvedPath, outputContent, "utf8");
          await log(`Wrote output to: ${resolvedPath} (${outputContent.length} chars)`);
        }
      }
      nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    // ── Operation ────────────────────────────────────────────────────────
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

      const resultState = { content: "" };

      if (loopEnabled && conditionPrompt) {
        const modelOverride = opData.llmModel ?? undefined;
        const loopState = { currentInput: input };

        for (const attempt of Array.from({ length: maxLoops }, (_, i) => i + 1)) {
          await log(
            `[Loop] Iteration ${attempt}/${maxLoops} for "${(node.data as unknown as Record<string, unknown>).label}"`
          );
          const loopResult = await executeOperationNode(node, loopState.currentInput);
          if (!loopResult.ok) {
            if (loopResult.error) return { ok: false, error: loopResult.error };
            break;
          }
          resultState.content = loopResult.content;
          loopState.currentInput = { inputPath: input.inputPath, content: resultState.content };

          const passed = await evaluateLoopCondition(
            conditionPrompt,
            resultState.content,
            modelOverride
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
        const nodeResult = await executeOperationNode(node, input);
        if (nodeResult.ok) {
          resultState.content = nodeResult.content;
          if (!resultState.content) {
            await log(`WARNING: Operation returned empty output — using parent input`);
            resultState.content = input.content;
          }
        } else if (nodeResult.error) {
          return { ok: false, error: nodeResult.error };
        }
      }

      nodeOutputs.set(node.id, { inputPath: input.inputPath, content: resultState.content });
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    // ── Output: output-project-path ──────────────────────────────────────
    if (node.type === "output-project-path") {
      const projPath = (data as Record<string, unknown>).path ?? input.inputPath;
      await log(`Output-to-project: changes written directly to ${projPath}`);
      nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    await log(`Skipped node type: ${node.type}`);
    nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  };

  // ── Resolve initial input if provided ──────────────────────────────────

  if (opts.inputPath && existsSync(opts.inputPath)) {
    const readResult = await safeReadInputFile(opts.inputPath);
    if (readResult.isOk()) {
      const { content, isFile } = readResult.value;
      nodeOutputs.set("__initial__", { inputPath: opts.inputPath, content });
      if (isFile) {
        await log(`Read input file: ${opts.inputPath} (${content.length} chars)`);
      }
    }
  }

  // ── Walk nodes level-by-level (concurrent within each level) ───────────

  for (const [levelIndex, level] of levels.entries()) {
    await log(`── Level ${levelIndex} (${level.length} node${level.length > 1 ? "s" : ""}) ──`);

    const results = await Promise.all(level.map((node) => processNode(node)));

    for (const result of results) {
      if (!result.ok) {
        await log(`Pipeline failed at level ${levelIndex}`);
        for (const dir of tempDirs) {
          await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
        }
        return { ok: false, error: result.error };
      }
    }
  }

  const outputPaths = nodes
    .filter((n) => n.type === "output-local-path")
    .map((n) => {
      const d = n.data as unknown as NodeData;
      return d.localPath ?? String((d as Record<string, unknown>).path ?? "");
    })
    .filter(Boolean);

  const summary =
    outputPaths.length > 0
      ? `Output written to: ${outputPaths.join(", ")}`
      : "Completed (no output-local-path node configured)";

  await log(`Pipeline complete. ${summary}`);

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
