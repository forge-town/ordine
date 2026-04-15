import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { PipelineNode, GitHubProjectNodeData, OutputMode } from "@repo/db-schema";
import { listDirTree, readProjectFiles, getParentIds } from "@repo/services";
import {
  ScriptExecutionError,
  type NodeData,
  type NodeCtx,
  type PipelineRunError,
  type PipelineExecutionCtx,
  type PipelineEngineDeps,
} from "./types";
import { cloneGitHubRepo } from "./infrastructure";
import { executeOperationNode, evaluateLoopCondition } from "./operationExecutor";

export const resolveNodeInput = (ctx: PipelineExecutionCtx, nodeId: string): NodeCtx => {
  const parentIds = getParentIds(nodeId, ctx.edges);
  if (parentIds.length === 0) {
    const initial = ctx.nodeOutputs.get("__initial__");
    return initial ?? { inputPath: "", content: "" };
  }
  if (parentIds.length === 1) {
    return ctx.nodeOutputs.get(parentIds[0]!) ?? { inputPath: "", content: "" };
  }
  const parentCtxs = parentIds
    .map((id) => ctx.nodeOutputs.get(id))
    .filter((c): c is NodeCtx => c !== undefined);
  const inputPath = parentCtxs.find((p) => p.inputPath)?.inputPath ?? "";
  const content = parentCtxs
    .map((p) => p.content)
    .filter(Boolean)
    .join("\n\n---\n\n");
  return { inputPath, content };
};

export const processNode = async (
  ctx: PipelineExecutionCtx,
  node: PipelineNode,
  deps: PipelineEngineDeps,
): Promise<{ ok: true } | { ok: false; error: PipelineRunError }> => {
  const data = node.data as unknown as NodeData;
  const input = resolveNodeInput(ctx, node.id);

  await ctx.log(
    `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`,
  );
  await ctx.log(`@@NODE_START::${node.id}`);

  // ── Input: folder ────────────────────────────────────────────────────
  if (node.type === "folder") {
    const rawPath = data.folderPath ?? "";
    const p = rawPath || input.inputPath || "";
    const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];
    const includedExtensions: string[] | undefined = Array.isArray(data.includedExtensions)
      ? data.includedExtensions
      : undefined;
    const disclosureMode = data.disclosureMode ?? "tree";
    if (p && existsSync(p) && statSync(p).isDirectory()) {
      const tree = await listDirTree(p, { excludedPaths });
      const readOpts = { excludedPaths, includedExtensions };
      const content = await (async () => {
        if (disclosureMode === "full") {
          const fileContents = await readProjectFiles(p, readOpts);
          await ctx.log(
            `Input folder: ${p} (disclosure: full, tree: ${tree.split("\n").length} entries, contents: ${fileContents.length} chars)`,
          );
          return `Folder: ${p}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
        }
        if (disclosureMode === "files-only") {
          const fileContents = await readProjectFiles(p, readOpts);
          await ctx.log(
            `Input folder: ${p} (disclosure: files-only, ${fileContents.length} chars)`,
          );
          return `Folder: ${p}\n\nFile contents:\n\n${fileContents}`;
        }
        await ctx.log(`Input folder: ${p} (tree: ${tree.split("\n").length} entries)`);
        return `Folder: ${p}\n\nFile tree:\n${tree}`;
      })();
      ctx.nodeOutputs.set(node.id, { inputPath: p, content });
    } else {
      ctx.nodeOutputs.set(node.id, { inputPath: p, content: "" });
    }
    await ctx.log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  // ── Input: code-file ─────────────────────────────────────────────────
  if (node.type === "code-file") {
    const p = data.filePath ?? "";
    if (p && existsSync(p)) {
      const content = await readFile(p, "utf8");
      ctx.nodeOutputs.set(node.id, { inputPath: p, content });
      await ctx.log(`Read code file: ${p} (${content.length} chars)`);
    } else {
      ctx.nodeOutputs.set(node.id, { inputPath: p, content: "" });
    }
    await ctx.log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  // ── Input: github-project ────────────────────────────────────────────
  if (node.type === "github-project") {
    const ghData = node.data as unknown as GitHubProjectNodeData;
    const disclosureMode = ghData.disclosureMode ?? "tree";
    const excludedPaths: string[] = Array.isArray(ghData.excludedPaths) ? ghData.excludedPaths : [];

    const buildProjectContent = async (dir: string, label: string): Promise<string> => {
      const treeOpts = { excludedPaths };
      if (disclosureMode === "tree") {
        const tree = await listDirTree(dir, treeOpts);
        await ctx.log(
          `Disclosure mode: tree (${tree.split("\n").length} entries, excluded: [${excludedPaths.join(", ")}])`,
        );
        return `${label}\n\nFile tree:\n${tree}`;
      }
      if (disclosureMode === "full") {
        const tree = await listDirTree(dir, treeOpts);
        const fileContents = await readProjectFiles(dir, { excludedPaths });
        await ctx.log(
          `Disclosure mode: full (tree + file contents, ${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
        );
        return `${label}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
      }
      const fileContents = await readProjectFiles(dir, { excludedPaths });
      await ctx.log(
        `Disclosure mode: files-only (${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
      );
      return `${label}\n\nFile contents:\n\n${fileContents}`;
    };

    if (ghData.sourceType === "local") {
      const localPath = ghData.localPath ?? "";
      if (!localPath) {
        await ctx.log(`WARNING: GitHub project node (local) missing localPath, skipping`);
        await ctx.log(`@@NODE_FAIL::${node.id}`);
        ctx.nodeOutputs.set(node.id, { inputPath: "", content: "" });
        return { ok: true };
      }
      await ctx.log(`Using local folder: ${localPath}`);
      const content = await buildProjectContent(localPath, `Local Folder: ${localPath}`);
      ctx.nodeOutputs.set(node.id, { inputPath: localPath, content });
      await ctx.log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    const owner = ghData.owner;
    const repo = ghData.repo;
    const branch = ghData.branch ?? "main";

    if (!owner || !repo) {
      await ctx.log(`WARNING: GitHub project node missing owner/repo, skipping`);
      await ctx.log(`@@NODE_FAIL::${node.id}`);
      ctx.nodeOutputs.set(node.id, { inputPath: "", content: "" });
      return { ok: true };
    }

    await ctx.log(`Cloning GitHub repo ${owner}/${repo}@${branch}...`);
    const cloneResult = await cloneGitHubRepo(owner, repo, branch, ctx.githubToken);
    if (cloneResult.isErr()) {
      await ctx.log(`ERROR: ${cloneResult.error.message}`);
      await ctx.log(`@@NODE_FAIL::${node.id}`);
      return { ok: false, error: cloneResult.error };
    }

    const clonedDir = cloneResult.value;
    ctx.tempDirs.push(clonedDir);
    const content = await buildProjectContent(
      clonedDir,
      `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`,
    );
    ctx.nodeOutputs.set(node.id, { inputPath: clonedDir, content });
    await ctx.log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  // ── Output: output-local-path ────────────────────────────────────────
  if (node.type === "output-local-path") {
    const rawPath: string = data.localPath ?? String((data as Record<string, unknown>).path ?? "");
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
        await ctx.log(`ERROR: Output file already exists: ${resolvedPath} (mode: error_if_exists)`);
        await ctx.log(`@@NODE_FAIL::${node.id}`);
        return {
          ok: false,
          error: new ScriptExecutionError(
            `Output file already exists: ${resolvedPath}. Pipeline aborted (output mode: error_if_exists).`,
          ),
        };
      }
      if (outputMode === "auto_rename") {
        await ctx.log(`Auto-renamed to avoid conflict: ${resolvedPath}`);
      }
    }

    await ctx.log(
      `Output path set: ${resolvedPath} (mode: ${outputMode}, dualOutput: ${dualOutput})`,
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
        await ctx.log(`Wrote JSON output to: ${jsonPath} (${cleanContent.length} chars)`);

        const mdPath = join(outputDir, `${baseName}.md`);
        const mdContent = deps.structuredJsonToMarkdown(cleanContent);
        await writeFile(mdPath, mdContent, "utf8");
        await ctx.log(`Wrote Markdown output to: ${mdPath} (${mdContent.length} chars)`);
      } else {
        const outputContent =
          extname(resolvedPath) === ".md"
            ? deps.structuredJsonToMarkdown(input.content)
            : input.content;
        await mkdir(dirname(resolvedPath), { recursive: true });
        await writeFile(resolvedPath, outputContent, "utf8");
        await ctx.log(`Wrote output to: ${resolvedPath} (${outputContent.length} chars)`);
      }
    }
    ctx.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await ctx.log(`@@NODE_DONE::${node.id}`);
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
        await ctx.log(
          `[Loop] Iteration ${attempt}/${maxLoops} for "${(node.data as unknown as Record<string, unknown>).label}"`,
        );
        const loopResult = await executeOperationNode(ctx, node, loopState.currentInput, deps);
        if (!loopResult.ok) {
          if (loopResult.error) return { ok: false, error: loopResult.error };
          break;
        }
        resultState.content = loopResult.content;
        loopState.currentInput = { inputPath: input.inputPath, content: resultState.content };

        const passed = await evaluateLoopCondition(
          ctx,
          conditionPrompt,
          resultState.content,
          modelOverride,
        );
        if (passed) {
          await ctx.log(`[Loop] Condition PASSED on iteration ${attempt}`);
          break;
        }
        if (attempt === maxLoops) {
          await ctx.log(
            `[Loop] Max iterations (${maxLoops}) reached — proceeding with last result`,
          );
        } else {
          await ctx.log(`[Loop] Condition FAILED — retrying...`);
        }
      }
    } else {
      const nodeResult = await executeOperationNode(ctx, node, input, deps);
      if (nodeResult.ok) {
        resultState.content = nodeResult.content;
        if (!resultState.content) {
          await ctx.log(`WARNING: Operation returned empty output — using parent input`);
          resultState.content = input.content;
        }
      } else if (nodeResult.error) {
        return { ok: false, error: nodeResult.error };
      }
    }

    ctx.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: resultState.content });
    await ctx.log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  // ── Output: output-project-path ──────────────────────────────────────
  if (node.type === "output-project-path") {
    const projPath = (data as Record<string, unknown>).path ?? input.inputPath;
    await ctx.log(`Output-to-project: changes written directly to ${projPath}`);
    ctx.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await ctx.log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  await ctx.log(`Skipped node type: ${node.type}`);
  ctx.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
  await ctx.log(`@@NODE_DONE::${node.id}`);
  return { ok: true };
};
