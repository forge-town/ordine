import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { ResultAsync, ok, err } from "neverthrow";

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  path: string;
}

export type FilesystemError =
  | { type: "DirectoryNotFound"; message: string }
  | { type: "NotADirectory"; message: string }
  | { type: "PermissionDenied"; message: string };

export const listDirectory = (dirPath?: string): ResultAsync<DirectoryEntry[], FilesystemError> => {
  const resolvedPath = dirPath ?? homedir();

  return ResultAsync.fromPromise(stat(resolvedPath), () => ({
    type: "DirectoryNotFound" as const,
    message: `Path does not exist: ${resolvedPath}`,
  }))
    .andThen((stats) => {
      if (!stats.isDirectory()) {
        return err({
          type: "NotADirectory" as const,
          message: `Not a directory: ${resolvedPath}`,
        });
      }
      return ok(stats);
    })
    .andThen(() =>
      ResultAsync.fromPromise(readdir(resolvedPath, { withFileTypes: true }), () => ({
        type: "PermissionDenied" as const,
        message: `Cannot read directory: ${resolvedPath}`,
      }))
    )
    .map((dirents) => {
      const entries: DirectoryEntry[] = dirents.map((d) => ({
        name: d.name,
        type: d.isDirectory() ? ("directory" as const) : ("file" as const),
        path: join(resolvedPath, d.name),
      }));

      return entries.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "directory" ? -1 : 1;
      });
    });
};

// ─── Directory tree ────────────────────────────────────────────────────────────

export interface ListDirTreeOptions {
  excludedPaths?: string[];
  maxDepth?: number;
}

const DEFAULT_EXCLUDED = [".git"];
const DEFAULT_MAX_DEPTH = 4;

export const listDirTree = async (
  rootDir: string,
  options?: ListDirTreeOptions
): Promise<string> => {
  if (!existsSync(rootDir)) return "";

  const excludedPaths = options?.excludedPaths ?? [];
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const allExcluded = [...DEFAULT_EXCLUDED, ...excludedPaths];

  const walk = async (dir: string, prefix: string, depth: number): Promise<string> => {
    if (depth >= maxDepth) return `${prefix}...\n`;
    const entries = await readdir(dir, { withFileTypes: true });
    const filtered = entries.filter((e) => {
      const rel = relative(rootDir, join(dir, e.name));
      return !allExcluded.some((excluded) => rel === excluded || rel.startsWith(`${excluded}/`));
    });
    const lines: string[] = [];
    for (const entry of filtered) {
      if (entry.isDirectory()) {
        lines.push(`${prefix}${entry.name}/`);
        lines.push(await walk(join(dir, entry.name), `${prefix}  `, depth + 1));
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
    return lines.join("\n");
  };

  return walk(rootDir, "", 0);
};
