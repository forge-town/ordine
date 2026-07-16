import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";
import { Result } from "neverthrow";

/** Expand a leading `~` / `~/...` to the user's home directory (only the prefix, never mid-path). */
export const expandHome = (input: string): string => {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return join(homedir(), input.slice(2));

  return input;
};

/**
 * Resolve inputPath to a directory that actually exists, for use as a cwd.
 * - empty / http(s) URL -> process.cwd()
 * - a leading `~` is expanded to the home directory first (statSync cannot resolve it)
 * - existing file -> its parent directory
 * - existing directory -> as-is
 * - non-existent path (placeholder or unset, e.g. a proposal-generated `~/Desktop/x`)
 *   -> fall back to process.cwd(); never hand an invalid path to a child process
 *   (spawn would fail with ENOENT).
 */
export const resolveCwd = ({ inputPath }: { inputPath: string | undefined }): string => {
  if (!inputPath) return process.cwd();
  if (inputPath.startsWith("http://") || inputPath.startsWith("https://")) return process.cwd();

  const expanded = expandHome(inputPath);

  const result = Result.fromThrowable(
    () => statSync(expanded),
    () => undefined,
  )();

  if (result.isErr()) {
    // Path does not exist (placeholder or unset): fall back to the process cwd.
    return process.cwd();
  }

  if (!result.value.isDirectory()) {
    return dirname(expanded);
  }

  return expanded;
};
