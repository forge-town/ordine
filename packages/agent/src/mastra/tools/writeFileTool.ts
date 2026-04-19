import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createTool } from "@mastra/core/tools";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";

export const createWriteFileTool = (projectRoot: string) =>
  createTool({
    id: "writeFile",
    description:
      "Write content to a file. Creates the file if it does not exist, or overwrites it entirely. Use replaceInFile for surgical edits.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Relative file path from the project root, e.g. 'src/utils/helpers.ts'"),
      content: z.string().describe("The full file content to write"),
    }),
    execute: async ({ path: relPath, content }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      const mkdirResult = await ResultAsync.fromPromise(
        mkdir(dirname(fullPath), { recursive: true }),
        () => `Failed to create directory for: ${relPath}`,
      );
      if (mkdirResult.isErr()) return { error: mkdirResult.error };
      const writeResult = await ResultAsync.fromPromise(
        writeFile(fullPath, content, "utf8"),
        () => `Failed to write: ${relPath}`,
      );
      if (writeResult.isErr()) return { error: writeResult.error };

      return { written: true, path: relPath, size: content.length };
    },
  });
