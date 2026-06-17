import { readFile as fsReadFile, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, isAbsolute, join, relative } from "node:path";
import { ResultAsync } from "neverthrow";
import type { ArtifactFile, TemplateContentType } from "@repo/schemas";

const MAX_FILE_BYTES = 512 * 1024;
const HARD_MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 200;
const MAX_DEPTH = 6;
const SKIP_DIRS = new Set([".git", "node_modules", ".turbo", "dist", ".next"]);

const expandHome = (p: string): string =>
  p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;

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

const realOrNull = (p: string): Promise<string | null> =>
  ResultAsync.fromPromise(realpath(p), () => null).unwrapOr(null);

/** 解析 target 真实路径，且必须落在某个 allowedRoot 真实路径的子树内（含 symlink 防逃逸），否则抛错。 */
const assertWithinRoots = async (allowedRoots: string[], target: string): Promise<string> => {
  const realTarget = await realpath(expandHome(target));
  const resolvedRoots = await Promise.all(allowedRoots.map((r) => realOrNull(expandHome(r))));
  const realRoots = resolvedRoots.filter((r): r is string => r !== null);
  const allowed = realRoots.some((root) => {
    const rel = relative(root, realTarget);

    return !rel.startsWith("..") && !isAbsolute(rel);
  });
  if (!allowed) {
    throw new Error("Requested path is outside the allowed output roots");
  }

  return realTarget;
};

/**
 * 只读文件系统服务：仅服务于产物预览。两条不变量——
 * 1) 一切路径必须落在调用方给定的 allowedRoots 子树内（防目录穿越 + symlink 逃逸）；
 * 2) 单文件读取上限 512KB（超出截断 + 标记 truncated），不把大文件灌进内存/响应。
 */
export const createArtifactsService = () => {
  const listDir = async ({
    allowedRoots,
    dirPath,
  }: {
    allowedRoots: string[];
    dirPath: string;
  }): Promise<ArtifactFile[]> => {
    const realDir = await assertWithinRoots(allowedRoots, dirPath);
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
          files.push({
            path: relative(realDir, absFile),
            contentType: extToContentType(absFile),
            sizeBytes: info.size,
          });
        }
      }
    };

    await walk(realDir, 0);
    files.sort((a, b) => a.path.localeCompare(b.path));

    return files;
  };

  const readFile = async ({
    allowedRoots,
    filePath,
  }: {
    allowedRoots: string[];
    filePath: string;
  }): Promise<{
    content: string;
    contentType: TemplateContentType;
    sizeBytes: number;
    truncated: boolean;
  }> => {
    const realFile = await assertWithinRoots(allowedRoots, filePath);
    const info = await stat(realFile);
    if (!info.isFile()) {
      throw new Error("Requested path is not a file");
    }
    const contentType = extToContentType(realFile);

    // 超硬上限：不读入内存，直接回空 + truncated，避免大文件拖垮服务。
    if (info.size > HARD_MAX_BYTES) {
      return { content: "", contentType, sizeBytes: info.size, truncated: true };
    }

    const full = await fsReadFile(realFile, "utf8");
    const truncated = full.length > MAX_FILE_BYTES;

    return {
      content: truncated ? full.slice(0, MAX_FILE_BYTES) : full,
      contentType,
      sizeBytes: info.size,
      truncated,
    };
  };

  return { listDir, readFile };
};
