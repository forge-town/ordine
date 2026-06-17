import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, relative } from "node:path";
import {
  ARTIFACT_KIND_ENUM,
  type ArtifactFile,
  type NodeArtifact,
  type TemplateContentType,
} from "@repo/schemas";

const MAX_FILES = 200;
const MAX_DEPTH = 6;
const SKIP_DIRS = new Set([".git", "node_modules", ".turbo", "dist", ".next"]);

const EXT_CONTENT_TYPE: Record<string, TemplateContentType> = {
  ".html": "html",
  ".htm": "html",
  ".md": "markdown",
  ".markdown": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".xml": "xml",
  ".svg": "xml",
  ".csv": "csv",
};

const extToContentType = (path: string): TemplateContentType =>
  EXT_CONTENT_TYPE[extname(path).toLowerCase()] ?? "text";

const scanDir = async (root: string, sinceMs: number): Promise<ArtifactFile[]> => {
  const files: ArtifactFile[] = [];

  const walk = async (abs: string, depth: number): Promise<void> => {
    if (files.length >= MAX_FILES || depth > MAX_DEPTH) return;
    const entries = await readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(join(abs, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const absFile = join(abs, entry.name);
        const info = await stat(absFile);
        // 只收本次执行窗口内写出/改动的文件，跳过共享 outputDir 里的旧残留。
        if (info.mtimeMs < sinceMs) continue;
        files.push({
          path: relative(root, absFile),
          contentType: extToContentType(absFile),
          sizeBytes: info.size,
        });
      }
    }
  };

  await walk(root, 0);
  files.sort((a, b) => a.path.localeCompare(b.path));

  return files;
};

/**
 * 把 agent 写出的 outputDir 捕获为 dir 工件（仅前端预览用，不动 NodeCtx 主通道）。
 * 只收 mtime ≥ sinceMs 的文件（本次执行窗口写出的），避免共享 outputDir 里他节点/上轮残留
 * 被误算成本节点产物。目录不存在或本次无新文件 → 返回 null（不发空/误属工件）。
 * 诚实代价：仅记目录 + 文件清单（path 捷径），逐文件数据契约延后（一等文件集模型）；
 * 仅经 symlink 可达的文件不在清单内（见手册遗留）。
 */
export const captureOutputArtifact = async (
  outputDir: string | undefined,
  label?: string,
  sinceMs = 0,
): Promise<NodeArtifact | null> => {
  if (!outputDir || !existsSync(outputDir)) return null;
  const files = await scanDir(outputDir, sinceMs);
  if (files.length === 0) return null;

  return {
    kind: ARTIFACT_KIND_ENUM.DIR,
    contentType: "text",
    content: outputDir,
    files,
    label,
  };
};
