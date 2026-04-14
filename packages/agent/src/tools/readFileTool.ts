import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

const MAX_READ_SIZE = 100_000;

export const createReadFileTool = (projectRoot: string) =>
  createTool({
    id: "readFile",
    description: "Read the contents of a file. Use relative paths from the project root.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Relative file path from the project root, e.g. 'src/components/Button.tsx'"),
    }),
    execute: async ({ path: relPath }) => {
      const fullPath = join(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      try {
        const content = await readFile(fullPath, "utf8");
        if (content.length > MAX_READ_SIZE) {
          return {
            content: content.slice(0, MAX_READ_SIZE),
            truncated: true,
            totalSize: content.length,
          };
        }
        return { content, truncated: false, totalSize: content.length };
      } catch {
        return { error: `File not found or unreadable: ${relPath}` };
      }
    },
  });
