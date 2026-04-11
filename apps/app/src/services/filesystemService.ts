import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
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

export const listDirectory = (
  dirPath?: string,
): ResultAsync<DirectoryEntry[], FilesystemError> => {
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
      ResultAsync.fromPromise(
        readdir(resolvedPath, { withFileTypes: true }),
        () => ({
          type: "PermissionDenied" as const,
          message: `Cannot read directory: ${resolvedPath}`,
        }),
      ),
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
  options?: ListDirTreeOptions,
): Promise<string> => {
  if (!existsSync(rootDir)) return "";

  const excludedPaths = options?.excludedPaths ?? [];
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const allExcluded = [...DEFAULT_EXCLUDED, ...excludedPaths];

  const walk = async (
    dir: string,
    prefix: string,
    depth: number,
  ): Promise<string> => {
    if (depth >= maxDepth) return `${prefix}...\n`;
    const entries = await readdir(dir, { withFileTypes: true });
    const filtered = entries.filter((e) => {
      const rel = relative(rootDir, join(dir, e.name));
      return !allExcluded.some(
        (excluded) => rel === excluded || rel.startsWith(`${excluded}/`),
      );
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

// ─── Read project file contents ────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".toml",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".vue",
  ".svelte",
  ".sql",
  ".graphql",
  ".gql",
  ".sh",
  ".bash",
  ".zsh",
  ".env",
  ".env.example",
  ".gitignore",
  ".eslintrc",
  ".prettierrc",
  ".editorconfig",
]);

const ALWAYS_EXCLUDED = [
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".cache",
  "coverage",
  ".ordine",
  "bun.lockb",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

const MAX_FILE_SIZE = 50_000; // 50KB per file
const MAX_TOTAL_SIZE = 500_000; // 500KB total

export interface ReadProjectFilesOptions {
  excludedPaths?: string[];
  maxDepth?: number;
}

export const readProjectFiles = async (
  rootDir: string,
  options?: ReadProjectFilesOptions,
): Promise<string> => {
  if (!existsSync(rootDir)) return "";

  const excludedPaths = options?.excludedPaths ?? [];
  const maxDepth = options?.maxDepth ?? 6;
  const allExcluded = [...ALWAYS_EXCLUDED, ...excludedPaths];

  const isExcluded = (rel: string) =>
    allExcluded.some((ex) => rel === ex || rel.startsWith(`${ex}/`));

  const isTextFile = (name: string) => {
    const ext = extname(name).toLowerCase();
    return TEXT_EXTENSIONS.has(ext) || name.startsWith(".");
  };

  const files: { rel: string; content: string }[] = [];
  let totalSize = 0;

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth >= maxDepth || totalSize >= MAX_TOTAL_SIZE) return;
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const rel = relative(rootDir, join(dir, entry.name));
      if (isExcluded(rel)) continue;

      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), depth + 1);
      } else if (isTextFile(entry.name)) {
        if (totalSize >= MAX_TOTAL_SIZE) break;
        try {
          const fileStat = await stat(join(dir, entry.name));
          if (fileStat.size > MAX_FILE_SIZE) continue;
          const content = await readFile(join(dir, entry.name), "utf8");
          totalSize += content.length;
          files.push({ rel, content });
        } catch {
          // skip unreadable files
        }
      }
    }
  };

  await walk(rootDir, 0);

  const parts = files.map((f) => `--- ${f.rel} ---\n${f.content}`);

  if (totalSize >= MAX_TOTAL_SIZE) {
    parts.push(
      `\n... (truncated at ${MAX_TOTAL_SIZE} chars total, ${files.length} files included)`,
    );
  }

  return parts.join("\n\n");
};
