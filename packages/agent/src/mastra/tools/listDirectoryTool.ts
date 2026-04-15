import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createTool } from "@mastra/core/tools";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";

export const createListDirectoryTool = (projectRoot: string) =>
  createTool({
    id: "listDirectory",
    description: "List entries in a directory. Returns file and folder names with types.",
    inputSchema: z.object({
      path: z.string().describe("Relative directory path from project root, e.g. 'src/pages'"),
    }),
    execute: async ({ path: relPath }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      const result = await ResultAsync.fromPromise(
        readdir(fullPath, { withFileTypes: true }),
        () => `Directory not found: ${relPath}`,
      );
      if (result.isErr()) return { error: result.error };
      return result.value.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
    },
  });
