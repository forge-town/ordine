import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTool } from "@mastra/core/tools";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";

export const createReplaceInFileTool = (projectRoot: string) =>
  createTool({
    id: "replaceInFile",
    description:
      "Replace an exact string occurrence in a file. The oldString must match exactly (including whitespace and indentation). Safer than writeFile for small edits.",
    inputSchema: z.object({
      path: z.string().describe("Relative file path from the project root"),
      oldString: z
        .string()
        .describe(
          "The exact literal text to find and replace. Must appear exactly once in the file.",
        ),
      newString: z.string().describe("The replacement text"),
    }),
    execute: async ({ path: relPath, oldString, newString }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      const result = await ResultAsync.fromPromise(
        readFile(fullPath, "utf8"),
        () => `Failed to read: ${relPath}`,
      );
      if (result.isErr()) return { error: result.error };
      const content = result.value;
      const count = content.split(oldString).length - 1;
      if (count === 0) return { error: "oldString not found in file" };
      if (count > 1) {
        return {
          error: `oldString appears ${count} times — must be unique. Add more context.`,
        };
      }
      const updated = content.replace(oldString, newString);
      const writeResult = await ResultAsync.fromPromise(
        writeFile(fullPath, updated, "utf8"),
        () => `Failed to write: ${relPath}`,
      );
      if (writeResult.isErr()) return { error: writeResult.error };
      return { replaced: true, path: relPath };
    },
  });
