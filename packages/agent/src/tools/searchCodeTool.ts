import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

const MAX_RESULTS = 30;

export const createSearchCodeTool = (projectRoot: string) =>
  createTool({
    id: "searchCode",
    description:
      "Search for a text pattern in files under a directory. Returns matching file paths and line content.",
    inputSchema: z.object({
      pattern: z.string().describe("Text or regex pattern to search for"),
      directory: z.string().describe("Relative directory to search in, e.g. 'src/pages'"),
      fileExtensions: z
        .array(z.string())
        .optional()
        .describe("File extensions to include, e.g. ['.tsx', '.ts']"),
    }),
    execute: async ({ pattern, directory, fileExtensions }) => {
      const searchDir = join(projectRoot, directory);
      if (!searchDir.startsWith(projectRoot)) {
        return { error: "Access denied: path outside project root" };
      }
      try {
        const exts = fileExtensions ?? [".ts", ".tsx", ".js", ".jsx"];
        const results: { file: string; line: number; content: string }[] = [];

        const walkSearch = async (dir: string): Promise<void> => {
          if (results.length >= MAX_RESULTS) return;
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= MAX_RESULTS) break;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
              if (entry.name === "node_modules" || entry.name === ".git") continue;
              await walkSearch(full);
            } else if (exts.some((ext: string) => entry.name.endsWith(ext))) {
              try {
                const content = await readFile(full, "utf8");
                const lines = content.split("\n");
                const regex = new RegExp(pattern, "gi");
                for (const [i, lineText] of lines.entries()) {
                  if (regex.test(lineText)) {
                    results.push({
                      file: relative(projectRoot, full),
                      line: i + 1,
                      content: lineText.trim().slice(0, 200),
                    });
                    if (results.length >= MAX_RESULTS) break;
                  }
                  regex.lastIndex = 0;
                }
              } catch {
                // skip unreadable files
              }
            }
          }
        };

        await walkSearch(searchDir);
        return {
          matches: results,
          totalMatches: results.length,
          truncated: results.length >= MAX_RESULTS,
        };
      } catch {
        return { error: `Search failed in ${directory}` };
      }
    },
  });
