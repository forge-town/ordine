import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
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
