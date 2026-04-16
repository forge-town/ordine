import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { trace } from "@repo/obs";
import type { NodeContext, NodeResult } from "./types.js";
import type { NodeData, OutputMode } from "../schemas/index.js";
import type { PipelineRunError } from "../errors.js";
import { ScriptExecutionError } from "../errors.js";

export const processOutputLocalPathNode = async (
  ctx: NodeContext,
): Promise<NodeResult | { ok: false; error: PipelineRunError }> => {
  const { node, input, deps, nodeOutputs, jobId } = ctx;
  const data = node.data as unknown as NodeData;
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
      await trace(
        jobId,
        `ERROR: Output file already exists: ${resolvedPath} (mode: error_if_exists)`,
      );
      await trace(jobId, `@@NODE_FAIL::${node.id}`);
      return {
        ok: false,
        error: new ScriptExecutionError(
          `Output file already exists: ${resolvedPath}. Pipeline aborted (output mode: error_if_exists).`,
        ),
      };
    }
    if (outputMode === "auto_rename") {
      await trace(jobId, `Auto-renamed to avoid conflict: ${resolvedPath}`);
    }
  }

  await trace(
    jobId,
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
      await trace(jobId, `Wrote JSON output to: ${jsonPath} (${cleanContent.length} chars)`);

      const mdPath = join(outputDir, `${baseName}.md`);
      const mdContent = deps.structuredJsonToMarkdown(cleanContent);
      await writeFile(mdPath, mdContent, "utf8");
      await trace(jobId, `Wrote Markdown output to: ${mdPath} (${mdContent.length} chars)`);
    } else {
      const outputContent =
        extname(resolvedPath) === ".md"
          ? deps.structuredJsonToMarkdown(input.content)
          : input.content;
      await mkdir(dirname(resolvedPath), { recursive: true });
      await writeFile(resolvedPath, outputContent, "utf8");
      await trace(jobId, `Wrote output to: ${resolvedPath} (${outputContent.length} chars)`);
    }
  }
  nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
  await trace(jobId, `@@NODE_DONE::${node.id}`);
  return { ok: true };
};
