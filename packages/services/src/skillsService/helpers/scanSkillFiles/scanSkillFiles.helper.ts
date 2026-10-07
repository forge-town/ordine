import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { ResultAsync } from "neverthrow";

const SKILL_FILE_NAME = "SKILL.md";

const MAX_SCAN_DEPTH = 6;

export const scanSkillFiles = async ({
  rootPath,
  currentDepth = 0,
}: {
  rootPath: string;
  currentDepth?: number;
}): Promise<{ paths: string[]; errors: string[] }> => {
  if (currentDepth > MAX_SCAN_DEPTH) {
    return { paths: [], errors: [] };
  }

  const entriesResult = await ResultAsync.fromPromise(
    readdir(rootPath, { withFileTypes: true }),
    (error) => error,
  );

  if (entriesResult.isErr()) {
    return { paths: [], errors: [`Failed to read ${rootPath}: ${String(entriesResult.error)}`] };
  }

  const paths: string[] = [];
  const errors: string[] = [];
  for (const entry of entriesResult.value) {
    const entryPath = join(rootPath, entry.name);
    if (entry.isFile() && entry.name === SKILL_FILE_NAME) {
      paths.push(entryPath);
    }
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const child = await scanSkillFiles({ rootPath: entryPath, currentDepth: currentDepth + 1 });
      paths.push(...child.paths);
      errors.push(...child.errors);
    }
  }

  return { paths, errors };
};
