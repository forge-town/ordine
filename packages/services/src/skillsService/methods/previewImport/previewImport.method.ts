import { readFile } from "node:fs/promises";

import { ResultAsync } from "neverthrow";

import type { SkillImportCandidate, SkillImportPreview } from "../../contracts";
import { parseSkillFile } from "../../helpers/parseSkillFile";
import { scanSkillFiles } from "../../helpers/scanSkillFiles";

export const createPreviewImportMethod =
  () =>
  async ({ rootPath }: { rootPath: string }): Promise<SkillImportPreview> => {
    const scanResult = await scanSkillFiles({ rootPath });
    const candidates: SkillImportCandidate[] = [];
    const errors = [...scanResult.errors];

    for (const path of scanResult.paths) {
      const contentResult = await ResultAsync.fromPromise(readFile(path, "utf8"), (error) => error);
      if (contentResult.isErr()) {
        errors.push(`Failed to read ${path}: ${String(contentResult.error)}`);
      } else {
        candidates.push(parseSkillFile({ path, content: contentResult.value }));
      }
    }

    return { candidates, errors };
  };
