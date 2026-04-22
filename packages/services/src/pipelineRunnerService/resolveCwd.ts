import { dirname } from "node:path";
import { statSync } from "node:fs";
import { Result } from "neverthrow";

/**
 * Resolve inputPath to a valid cwd directory.
 * If it's a file path, use its parent directory.
 */
export const resolveCwd = ({ inputPath }: { inputPath: string | undefined }): string => {
  if (!inputPath) return process.cwd();
  const result = Result.fromThrowable(
    () => statSync(inputPath),
    () => undefined,
  )();

  if (result.isOk() && !result.value.isDirectory()) {
    return dirname(inputPath);
  }

  return inputPath;
};
