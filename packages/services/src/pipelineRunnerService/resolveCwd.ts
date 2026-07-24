import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";
import { err, ok, Result } from "neverthrow";
import { logger } from "@repo/logger";

/** Expand a leading `~` / `~/...` / `~\...` to the user's home directory (only the prefix, never mid-path). */
export const expandHome = (input: string): string => {
  if (input === "~") return homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) return join(homedir(), input.slice(2));

  return input;
};

export class InputPathNotFoundError extends Error {
  constructor(public readonly inputPath: string) {
    super(
      `Input path "${inputPath}" does not exist or is not accessible. ` +
        "Point the node's input to an existing file or folder, or clear it to run in the default working directory.",
    );
    this.name = "InputPathNotFoundError";
  }
}

/**
 * Resolve inputPath to a directory that actually exists, for use as a cwd.
 * - absent / blank / http(s) URL -> ok(process.cwd()) — nothing was configured
 * - a leading `~` is expanded to the home directory first (statSync cannot resolve it)
 * - existing file -> ok(its parent directory)
 * - existing directory -> ok(as-is)
 * - explicitly configured path that does not exist -> err(InputPathNotFoundError);
 *   silently running in the wrong directory would corrupt the node's output,
 *   so the executor must fail the node instead.
 */
export const resolveCwd = ({
  inputPath,
}: {
  inputPath: string | undefined;
}): Result<string, InputPathNotFoundError> => {
  if (!inputPath || !inputPath.trim()) return ok(process.cwd());
  if (inputPath.startsWith("http://") || inputPath.startsWith("https://")) {
    return ok(process.cwd());
  }

  const expanded = expandHome(inputPath);

  const stat = Result.fromThrowable(
    () => statSync(expanded),
    () => undefined,
  )();

  if (stat.isErr()) {
    logger.warn(
      { inputPath, expanded },
      "resolveCwd: configured input path does not exist or is not accessible",
    );

    return err(new InputPathNotFoundError(inputPath));
  }

  if (!stat.value.isDirectory()) {
    return ok(dirname(expanded));
  }

  return ok(expanded);
};
