import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { ResultAsync } from "neverthrow";
import type {
  PipelineNode,
  PipelineEdge,
  GitHubProjectNodeData,
  OutputMode,
} from "./schemas/index.js";
import type { ExecutorConfig, NodeData, NodeCtx } from "./schemas/index.js";
import { ScriptExecutionError } from "./errors.js";
import type { PipelineRunError } from "./errors.js";
import type { PipelineEngineDeps } from "./deps.js";
import { buildExecutionLevels, getParentIds, CycleDetectedError } from "./dagScheduler.js";
import { runScript, cloneGitHubRepo, safeParseJson, safeReadInputFile } from "./infrastructure.js";

export { CycleDetectedError };

export type PipelineRunResult =
  | { ok: true; summary: string }
  | { ok: false; error: PipelineRunError | CycleDetectedError };

export interface PipelineDefinition {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface OperationInfo {
  id: string;
  name: string;
  config: string;
}

export interface SkillInfo {
  id: string;
  label: string;
  description: string;
}

export interface ExecutePipelineOpts {
  pipeline: PipelineDefinition;
  jobId: string;
  inputPath?: string;
  githubToken?: string;
  operations: Map<string, OperationInfo>;
  deps: PipelineEngineDeps;
  lookupSkill: (id: string) => Promise<SkillInfo | null>;
  lookupBestPractice: (id: string) => Promise<{ title: string; content: string } | null>;
}

export class PipelineEngine {
  private opts!: ExecutePipelineOpts;
  private tempDirs: string[] = [];
  private nodeOutputs = new Map<string, NodeCtx>();

  async execute(opts: ExecutePipelineOpts): Promise<PipelineRunResult> {
    this.opts = opts;
    this.tempDirs = [];
    this.nodeOutputs = new Map();

    const { pipeline, deps } = opts;
    const { log } = deps;
    const { nodes, edges } = pipeline;

    const levelsResult = buildExecutionLevels(nodes, edges);
    if (levelsResult.isErr()) {
      return { ok: false, error: levelsResult.error };
    }
    const levels = levelsResult.value;

    await log(
      `Pipeline "${pipeline.name}" loaded. ${nodes.length} nodes in ${levels.length} levels.`,
    );

    if (opts.inputPath && existsSync(opts.inputPath)) {
      const readResult = await safeReadInputFile(opts.inputPath);
      if (readResult.isOk()) {
        const { content, isFile } = readResult.value;
        this.nodeOutputs.set("__initial__", { inputPath: opts.inputPath, content });
        if (isFile) {
          await log(`Read input file: ${opts.inputPath} (${content.length} chars)`);
        }
      }
    }

    for (const [levelIndex, level] of levels.entries()) {
      await log(`── Level ${levelIndex} (${level.length} node${level.length > 1 ? "s" : ""}) ──`);

      const results = await Promise.all(level.map((node) => this.processNode(node)));

      for (const result of results) {
        if (!result.ok) {
          await log(`Pipeline failed at level ${levelIndex}`);
          await this.cleanupTempDirs();
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
    await this.cleanupTempDirs();

    return { ok: true, summary };
  }

  private resolveNodeInput(nodeId: string): NodeCtx {
    const edges = this.opts.pipeline.edges;
    const parentIds = getParentIds(nodeId, edges);
    if (parentIds.length === 0) {
      return this.nodeOutputs.get("__initial__") ?? { inputPath: "", content: "" };
    }
    if (parentIds.length === 1) {
      return this.nodeOutputs.get(parentIds[0]!) ?? { inputPath: "", content: "" };
    }
    const parentCtxs = parentIds
      .map((id) => this.nodeOutputs.get(id))
      .filter((c): c is NodeCtx => c !== undefined);
    const inputPath = parentCtxs.find((p) => p.inputPath)?.inputPath ?? "";
    const content = parentCtxs
      .map((p) => p.content)
      .filter(Boolean)
      .join("\n\n---\n\n");
    return { inputPath, content };
  }

  private async executeOperationNode(
    node: PipelineNode,
    input: NodeCtx,
  ): Promise<{ ok: true; content: string } | { ok: false; error: PipelineRunError | null }> {
    const { deps, operations } = this.opts;
    const { log } = deps;
    const data = node.data as NodeData;
    const operationId = data.operationId ?? "";
    const operation = operations.get(operationId);

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
      const bp = await this.opts.lookupBestPractice(opData.bestPracticeId);
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
      await log(`Running rule-check on path: ${input.inputPath}`);
      const checkOutput = await deps.runRuleCheck(input.inputPath);
      const checkResult = JSON.stringify(checkOutput, null, 2);
      await log(
        `Rule-check: ${checkOutput.stats.totalFindings} findings in ${checkOutput.stats.totalFiles} files`,
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
      const prompt = (executor as ExecutorConfig & { prompt?: string }).prompt ?? "";
      if (!prompt.trim()) {
        await log(`WARNING: Prompt text is empty for operation "${operation.name}", skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: null };
      }
      const promptResult = await deps.runPrompt({
        prompt,
        inputContent: effectiveInput,
        modelOverride,
        agent: executor.agent,
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
      const skillId = (executor as ExecutorConfig & { skillId?: string }).skillId ?? "";
      if (!skillId) {
        await log(`WARNING: No skillId configured for operation "${operation.name}", skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        return { ok: false, error: null };
      }

      const skill = await this.opts.lookupSkill(skillId);
      const skillDescription = skill
        ? `${skill.label}: ${skill.description}`
        : `Skill "${skillId}" (no description available)`;

      await log(`Running skill "${skillId}"${skill ? ` (${skill.label})` : ""}...`);
      const skillResult = await deps.runSkill({
        skillId,
        skillDescription,
        inputContent: effectiveInput,
        inputPath: input.inputPath,
        modelOverride,
        agent: executor.agent,
        onChunk: handleChunk,
        onProgress: log,
        writeEnabled:
          (executor as ExecutorConfig & { writeEnabled?: boolean }).writeEnabled === true,
      });
      opResult.value = skillResult.isOk() ? skillResult.value : "";
      await log(`@@LLM_CONTENT::${node.id}::${opResult.value}`);
      await log(`Skill output (${opResult.value.length} chars)`);
    }

    return { ok: true, content: opResult.value };
  }

  private async processNode(
    node: PipelineNode,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    const { deps } = this.opts;
    const { log } = deps;
    const data = node.data as unknown as NodeData;
    const input = this.resolveNodeInput(node.id);

    await log(
      `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`,
    );
    await log(`@@NODE_START::${node.id}`);

    if (node.type === "folder") {
      return this.processFolderNode(node, data);
    }

    if (node.type === "code-file") {
      return this.processCodeFileNode(node, data);
    }

    if (node.type === "github-project") {
      return this.processGitHubProjectNode(node);
    }

    if (node.type === "output-local-path") {
      return this.processOutputLocalPathNode(node, data, input);
    }

    if (node.type === "operation") {
      return this.processOperationNode(node, input);
    }

    if (node.type === "output-project-path") {
      const projPath = (data as Record<string, unknown>).path ?? input.inputPath;
      await log(`Output-to-project: changes written directly to ${projPath}`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    await log(`Skipped node type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async processFolderNode(node: PipelineNode, data: NodeData): Promise<{ ok: true }> {
    const { deps } = this.opts;
    const { log } = deps;
    const p = data.folderPath ?? "";
    const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];
    const includedExtensions: string[] | undefined = Array.isArray(data.includedExtensions)
      ? data.includedExtensions
      : undefined;
    const disclosureMode = data.disclosureMode ?? "tree";
    if (p && existsSync(p)) {
      const tree = await deps.listDirTree(p, { excludedPaths });
      const readOpts = { excludedPaths, includedExtensions };
      const content = await (async () => {
        if (disclosureMode === "full") {
          const fileContents = await deps.readProjectFiles(p, readOpts);
          await log(
            `Input folder: ${p} (disclosure: full, tree: ${tree.split("\n").length} entries, contents: ${fileContents.length} chars)`,
          );
          return `Folder: ${p}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
        }
        if (disclosureMode === "files-only") {
          const fileContents = await deps.readProjectFiles(p, readOpts);
          await log(`Input folder: ${p} (disclosure: files-only, ${fileContents.length} chars)`);
          return `Folder: ${p}\n\nFile contents:\n\n${fileContents}`;
        }
        await log(`Input folder: ${p} (tree: ${tree.split("\n").length} entries)`);
        return `Folder: ${p}\n\nFile tree:\n${tree}`;
      })();
      this.nodeOutputs.set(node.id, { inputPath: p, content });
    } else {
      this.nodeOutputs.set(node.id, { inputPath: p, content: "" });
    }
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async processCodeFileNode(node: PipelineNode, data: NodeData): Promise<{ ok: true }> {
    const { log } = this.opts.deps;
    const p = data.filePath ?? "";
    if (p && existsSync(p)) {
      const content = await readFile(p, "utf8");
      this.nodeOutputs.set(node.id, { inputPath: p, content });
      await log(`Read code file: ${p} (${content.length} chars)`);
    } else {
      this.nodeOutputs.set(node.id, { inputPath: p, content: "" });
    }
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async processGitHubProjectNode(
    node: PipelineNode,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError }> {
    const { deps, githubToken } = this.opts;
    const { log } = deps;
    const ghData = node.data as unknown as GitHubProjectNodeData;
    const disclosureMode = ghData.disclosureMode ?? "tree";
    const excludedPaths: string[] = Array.isArray(ghData.excludedPaths) ? ghData.excludedPaths : [];

    const buildProjectContent = async (dir: string, label: string): Promise<string> => {
      const treeOpts = { excludedPaths };
      if (disclosureMode === "tree") {
        const tree = await deps.listDirTree(dir, treeOpts);
        await log(
          `Disclosure mode: tree (${tree.split("\n").length} entries, excluded: [${excludedPaths.join(", ")}])`,
        );
        return `${label}\n\nFile tree:\n${tree}`;
      }
      if (disclosureMode === "full") {
        const tree = await deps.listDirTree(dir, treeOpts);
        const fileContents = await deps.readProjectFiles(dir, { excludedPaths });
        await log(
          `Disclosure mode: full (tree + file contents, ${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
        );
        return `${label}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
      }
      const fileContents = await deps.readProjectFiles(dir, { excludedPaths });
      await log(
        `Disclosure mode: files-only (${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
      );
      return `${label}\n\nFile contents:\n\n${fileContents}`;
    };

    if (ghData.sourceType === "local") {
      const localPath = ghData.localPath ?? "";
      if (!localPath) {
        await log(`WARNING: GitHub project node (local) missing localPath, skipping`);
        await log(`@@NODE_FAIL::${node.id}`);
        this.nodeOutputs.set(node.id, { inputPath: "", content: "" });
        return { ok: true };
      }
      await log(`Using local folder: ${localPath}`);
      const content = await buildProjectContent(localPath, `Local Folder: ${localPath}`);
      this.nodeOutputs.set(node.id, { inputPath: localPath, content });
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    const owner = ghData.owner;
    const repo = ghData.repo;
    const branch = ghData.branch ?? "main";

    if (!owner || !repo) {
      await log(`WARNING: GitHub project node missing owner/repo, skipping`);
      await log(`@@NODE_FAIL::${node.id}`);
      this.nodeOutputs.set(node.id, { inputPath: "", content: "" });
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
    this.tempDirs.push(clonedDir);
    const content = await buildProjectContent(
      clonedDir,
      `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`,
    );
    this.nodeOutputs.set(node.id, { inputPath: clonedDir, content });
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async processOutputLocalPathNode(
    node: PipelineNode,
    data: NodeData,
    input: NodeCtx,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError }> {
    const { deps, jobId } = this.opts;
    const { log } = deps;
    const rawPath: string = data.localPath ?? String((data as Record<string, unknown>).path ?? "");
    const baseOutputFileName = data.outputFileName?.trim() || "output.md";
    const outputMode: OutputMode = data.outputMode ?? "overwrite";
    const dualOutput = (data as Record<string, unknown>).dualOutput === true;

    const shortJobId = jobId.slice(0, 8);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fnExt = extname(baseOutputFileName);
    const fnBase = basename(baseOutputFileName, fnExt);
    const outputFileName = `${fnBase}_${shortJobId}_${timestamp}${fnExt}`;

    const resolvedPath = (() => {
      const initial = rawPath ? resolve(rawPath) : "";
      const resultsDir = initial ? join(initial, "results") : "";
      const withFile = resultsDir ? join(resultsDir, outputFileName) : initial;
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
            `Output file already exists: ${resolvedPath}. Pipeline aborted (output mode: error_if_exists).`,
          ),
        };
      }
      if (outputMode === "auto_rename") {
        await log(`Auto-renamed to avoid conflict: ${resolvedPath}`);
      }
    }

    await log(`Output path set: ${resolvedPath} (mode: ${outputMode}, dualOutput: ${dualOutput})`);
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
        const mdContent = deps.structuredJsonToMarkdown(cleanContent);
        await writeFile(mdPath, mdContent, "utf8");
        await log(`Wrote Markdown output to: ${mdPath} (${mdContent.length} chars)`);
      } else {
        const outputContent =
          extname(resolvedPath) === ".md"
            ? deps.structuredJsonToMarkdown(input.content)
            : input.content;
        await mkdir(dirname(resolvedPath), { recursive: true });
        await writeFile(resolvedPath, outputContent, "utf8");
        await log(`Wrote output to: ${resolvedPath} (${outputContent.length} chars)`);
      }
    }
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async processOperationNode(
    node: PipelineNode,
    input: NodeCtx,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError }> {
    const { log } = this.opts.deps;
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
          `[Loop] Iteration ${attempt}/${maxLoops} for "${(node.data as unknown as Record<string, unknown>).label}"`,
        );
        const loopResult = await this.executeOperationNode(node, loopState.currentInput);
        if (!loopResult.ok) {
          if (loopResult.error) return { ok: false, error: loopResult.error };
          break;
        }
        resultState.content = loopResult.content;
        loopState.currentInput = { inputPath: input.inputPath, content: resultState.content };

        const passed = await this.opts.deps.evaluateLoopCondition(
          conditionPrompt,
          resultState.content,
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
      const nodeResult = await this.executeOperationNode(node, input);
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

    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: resultState.content });
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async cleanupTempDirs(): Promise<void> {
    for (const dir of this.tempDirs) {
      await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
    }
  }
}

export const pipelineEngine = new PipelineEngine();
