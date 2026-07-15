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
    // Capture is best-effort preview: an unreadable directory yields no entries
    // rather than an exception that could sink an already-successful operation.
    const entries = await readdir(abs, { withFileTypes: true }).catch(() => null);
    if (!entries) return;
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(join(abs, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const absFile = join(abs, entry.name);
        // Tolerate races: a file removed between readdir and stat is simply not listed.
        const info = await stat(absFile).catch(() => null);
        if (!info) continue;
        // Only pick up files written/modified during this execution window; skip stale leftovers in the shared outputDir.
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
 * Captures the outputDir written by the agent as a "dir" artifact (frontend preview only;
 * the NodeCtx main channel is untouched). Only files with mtime >= sinceMs are included —
 * i.e. written during this execution window — so leftovers from other nodes or earlier runs
 * in the shared outputDir aren't misattributed to this node. If the directory is missing or
 * nothing new was written, returns null rather than emitting an empty/misattributed artifact.
 *
 * Known limitations (capture is best-effort preview, never a correctness channel):
 * the artifact records only the directory plus a file list (paths, not per-file data
 * contracts); files reachable only through symlinks are not listed; when several
 * concurrently running nodes share one outputDir their files can be over-attributed
 * to each other; and tools that preserve old mtimes (cp -p, tar) can make fresh files
 * fall outside the window. Precise attribution needs executor-reported file lists.
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
